export interface ImageSearchWorker {
  terminate(): Promise<unknown>;
}

/** Each run owns its worker. Cancellation cannot terminate a newer run's worker. */
export class ImageSearchSession<W extends ImageSearchWorker> {
  private active: AbortController | null = null;

  cancel() {
    this.active?.abort();
    this.active = null;
  }

  async run<T>(
    create: (signal: AbortSignal) => Promise<W>,
    recognize: (worker: W, signal: AbortSignal) => Promise<T>,
  ): Promise<T | undefined> {
    this.cancel();
    const controller = new AbortController();
    const { signal } = controller;
    this.active = controller;
    let worker: W | undefined;
    let stopped = false;
    const stop = async () => {
      if (worker && !stopped) {
        stopped = true;
        await worker.terminate().catch(() => {});
      }
    };
    let onAbort: () => void = () => {};
    const cancelled = new Promise<undefined>((resolve) => {
      onAbort = () => { void stop(); resolve(undefined); };
      signal.addEventListener("abort", onAbort, { once: true });
    });
    const work = async () => {
      try {
        worker = await create(signal);
        // Initialization may finish after close/replacement; dispose that worker too.
        if (signal.aborted) return undefined;
        const result = await recognize(worker, signal);
        return signal.aborted ? undefined : result;
      } catch (error) {
        if (!signal.aborted) throw error;
        return undefined;
      } finally {
        await stop();
      }
    };
    try {
      return await Promise.race([work(), cancelled]);
    } finally {
      signal.removeEventListener("abort", onAbort);
      if (this.active === controller) this.active = null;
      controller.abort();
    }
  }
}
