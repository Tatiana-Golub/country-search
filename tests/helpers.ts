import { vi } from 'vitest';

interface Route {
  delay: number;
  status?: number;
  body?: unknown;
}

export function mockFetch(route: (url: string) => Route) {
  const calls: { url: string; signal: AbortSignal }[] = [];

  const fn = vi.fn(
    (url: string, init?: RequestInit) =>
      new Promise<Response>((resolve, reject) => {
        const { delay, status = 200, body = [] } = route(url);
        const signal = init!.signal!;
        calls.push({ url, signal });

        if (signal.aborted) return reject(signal.reason);

        const payload = typeof body === 'string' ? body : JSON.stringify(body);
        const timer = setTimeout(() => resolve(new Response(payload, { status })), delay);

        signal.addEventListener('abort', () => {
          clearTimeout(timer);
          reject(signal.reason);
        });
      }),
  );

  vi.stubGlobal('fetch', fn);
  return { fn, calls };
}
