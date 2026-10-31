export const PADDLE_OCR_BASE = "/ocr/paddle-v0.3.1-ppocrv6-small-r1";

export interface PaddleProgress {
  stage: "loading" | "reading";
  loaded: number;
  total: number;
}

type WorkerPort = Pick<Worker, "postMessage" | "terminate" | "onmessage" | "onerror" | "onmessageerror">;
interface Reply {
  id: number;
  type: "ready" | "result" | "progress" | "error";
  results?: { text: string }[];
  stage?: PaddleProgress["stage"];
  loaded?: number;
  total?: number;
}

/** Keep ownership of the raw worker even while the 50 MB runtime is initializing. */
export class PaddleOcrClient {
  private port: WorkerPort;
  private progress: (progress: PaddleProgress) => void;
  private sequence = 0;
  private stopped = false;
  private pending: { id: number; resolve: (reply: Reply) => void; reject: (error: Error) => void } | null = null;

  constructor(port: WorkerPort, progress: (progress: PaddleProgress) => void) {
    this.port = port;
    this.progress = progress;
    port.onmessage = ({ data }: MessageEvent<Reply>) => {
      if (this.stopped || !this.pending || data.id !== this.pending.id) return;
      if (data.type === "progress") {
        if ((data.stage === "loading" || data.stage === "reading") &&
            Number.isFinite(data.loaded) && Number.isFinite(data.total) && data.total! > 0) {
          this.progress({ stage: data.stage, loaded: data.loaded!, total: data.total! });
        }
        return;
      }
      const pending = this.pending;
      this.pending = null;
      if (data.type === "error") pending.reject(new Error("OCR failed"));
      else pending.resolve(data);
    };
    port.onerror = port.onmessageerror = () => { this.fail(); };
  }

  private fail() {
    this.pending?.reject(new Error("OCR worker unavailable"));
    this.pending = null;
  }

  private request(type: "load" | "run", image?: ArrayBuffer): Promise<Reply> {
    if (this.stopped || this.pending) return Promise.reject(new Error("OCR worker unavailable"));
    return new Promise((resolve, reject) => {
      const id = ++this.sequence;
      this.pending = { id, resolve, reject };
      try { this.port.postMessage({ id, type, image }, image ? [image] : []); }
      catch { this.fail(); }
    });
  }

  async load(): Promise<void> {
    const reply = await this.request("load");
    if (reply.type !== "ready") throw new Error("Unexpected OCR response");
  }

  async recognize(image: ArrayBuffer): Promise<string[]> {
    const reply = await this.request("run", image);
    if (reply.type !== "result" || !Array.isArray(reply.results) ||
        reply.results.some((result) => typeof result.text !== "string")) throw new Error("Invalid OCR results");
    // No trimming, joining or space replacement inside recognized names.
    return reply.results.map((result) => result.text);
  }

  async terminate(): Promise<void> {
    if (this.stopped) return;
    this.stopped = true;
    this.fail();
    this.port.terminate();
  }
}

export function createPaddleOcrClient(progress: (progress: PaddleProgress) => void): PaddleOcrClient {
  return new PaddleOcrClient(new Worker(`${PADDLE_OCR_BASE}/worker.js`, { type: "module" }), progress);
}
