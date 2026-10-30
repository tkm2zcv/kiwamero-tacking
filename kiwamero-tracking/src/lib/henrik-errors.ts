export class HenrikDevError extends Error {
  readonly status: number;
  readonly retryAfter: number;
  constructor(
    status: number,
    message: string,
    retryAfter = 60,
  ) {
    super(message);
    this.name = "HenrikDevError";
    this.status = status;
    this.retryAfter = retryAfter;
  }
}
