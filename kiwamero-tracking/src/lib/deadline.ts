export class DeadlineExceeded extends Error {
  constructor() {
    super("Read deadline exceeded");
    this.name = "DeadlineExceeded";
  }
}

/** Request-time I/O budgets, not timestamps used to derive rendered content. */
export function deadlineAfter(ms: number): number {
  return Date.now() + ms;
}
export function hasTimeRemaining(deadline: number): boolean {
  return Date.now() < deadline;
}

/** Bound the caller's wait without cancelling work shared with other requests. */
export async function beforeDeadline<T>(task: Promise<T>, deadline: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      task,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new DeadlineExceeded()), Math.max(0, deadline - Date.now()));
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}
