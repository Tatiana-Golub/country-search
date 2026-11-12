export class HttpError extends Error {
  constructor(public readonly status: number) {
    super(`HTTP ${status}`);
    this.name = 'HttpError';
  }
}

export type ErrorKind = 'aborted' | 'timeout' | 'http' | 'network';

export function classifyError(error: unknown): ErrorKind {
  if (error instanceof HttpError) return 'http';

  const name = (error as { name?: unknown } | null | undefined)?.name;
  if (name === 'AbortError') return 'aborted';
  if (name === 'TimeoutError') return 'timeout';

  return 'network';
}
