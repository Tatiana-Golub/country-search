const normalize = (query) => query.trim().toLowerCase();
const createAbortError = () => new DOMException('Aborted', 'AbortError');
export function createCachedSearch(search) {
    const cache = new Map();
    const inFlight = new Map();
    function startRequest(key) {
        const controller = new AbortController();
        const request = {
            controller,
            subscribers: 0,
            promise: search(key, controller.signal)
                .then((result) => {
                cache.set(key, result);
                return result;
            })
                .finally(() => {
                if (inFlight.get(key) === request)
                    inFlight.delete(key);
            }),
        };
        inFlight.set(key, request);
        return request;
    }
    function subscribe(key, request, signal) {
        request.subscribers++;
        return new Promise((resolve, reject) => {
            const onAbort = () => {
                request.subscribers--;
                if (request.subscribers === 0) {
                    if (inFlight.get(key) === request)
                        inFlight.delete(key);
                    request.controller.abort();
                }
                reject(signal.reason ?? createAbortError());
            };
            signal.addEventListener('abort', onAbort, { once: true });
            request.promise.then((result) => {
                signal.removeEventListener('abort', onAbort);
                resolve(result);
            }, (error) => {
                signal.removeEventListener('abort', onAbort);
                reject(error);
            });
        });
    }
    return (query, signal) => {
        if (signal.aborted)
            return Promise.reject(signal.reason ?? createAbortError());
        const key = normalize(query);
        const cached = cache.get(key);
        if (cached)
            return Promise.resolve(cached);
        const request = inFlight.get(key) ?? startRequest(key);
        return subscribe(key, request, signal);
    };
}
