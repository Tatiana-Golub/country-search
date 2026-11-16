export class HttpError extends Error {
    status;
    constructor(status) {
        super(`HTTP ${status}`);
        this.status = status;
        this.name = 'HttpError';
    }
}
export function classifyError(error) {
    if (error instanceof HttpError)
        return 'http';
    const name = error?.name;
    if (name === 'AbortError')
        return 'aborted';
    if (name === 'TimeoutError')
        return 'timeout';
    return 'network';
}
