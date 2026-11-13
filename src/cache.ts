import type { SearchFn } from './api.js';

interface InFlightRequest {
  promise: Promise<unknown[]>;
  controller: AbortController;
  subscribers: number;
}

const normalize = (query: string): string => query.trim().toLowerCase();
const createAbortError = (): DOMException => new DOMException('Aborted', 'AbortError');

export function createCachedSearch(search: SearchFn): SearchFn {
  const cache = new Map<string, unknown[]>();
  const inFlight = new Map<string, InFlightRequest>();

  function startRequest(key: string): InFlightRequest {
    const controller = new AbortController();

    const request: InFlightRequest = {
      controller,
      subscribers: 0,
      promise: search(key, controller.signal)
        .then((result) => {
          cache.set(key, result);
          return result;
        })
        .finally(() => {
          if (inFlight.get(key) === request) inFlight.delete(key);
        }),
    };

    inFlight.set(key, request);
    return request;
  }

  function subscribe(
    key: string,
    request: InFlightRequest,
    signal: AbortSignal,
  ): Promise<unknown[]> {
    request.subscribers++;

    return new Promise((resolve, reject) => {
      const onAbort = () => {
        request.subscribers--;
        if (request.subscribers === 0) {
          if (inFlight.get(key) === request) inFlight.delete(key);
          request.controller.abort();
        }
        reject(signal.reason ?? createAbortError());
      };

      signal.addEventListener('abort', onAbort, { once: true });

      request.promise.then(
        (result) => {
          signal.removeEventListener('abort', onAbort);
          resolve(result);
        },
        (error) => {
          signal.removeEventListener('abort', onAbort);
          reject(error);
        },
      );
    });
  }

  return (query, signal) => {
    if (signal.aborted) return Promise.reject(signal.reason ?? createAbortError());

    const key = normalize(query);

    const cached = cache.get(key);
    if (cached) return Promise.resolve(cached);

    const request = inFlight.get(key) ?? startRequest(key);
    return subscribe(key, request, signal);
  };
}
