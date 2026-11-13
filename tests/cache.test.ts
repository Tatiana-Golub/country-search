import { describe, expect, it, vi } from 'vitest';
import { createCachedSearch } from '../src/cache.js';
import { HttpError } from '../src/errors.js';

function controllableSearch() {
  const requests: {
    query: string;
    signal: AbortSignal;
    resolve: (value: unknown[]) => void;
    reject: (reason: unknown) => void;
  }[] = [];

  const search = vi.fn(
    (query: string, signal: AbortSignal) =>
      new Promise<unknown[]>((resolve, reject) => {
        requests.push({ query, signal, resolve, reject });
        signal.addEventListener('abort', () => reject(signal.reason));
      }),
  );

  return { search, requests };
}

const newCaller = () => new AbortController();

describe('createCachedSearch', () => {
  it('serves a repeated query from the cache, ignoring case and spaces', async () => {
    const search = vi.fn(async () => [{ name: 'Spain' }]);
    const cached = createCachedSearch(search);

    await cached('Spain', newCaller().signal);
    const second = await cached('  spain ', newCaller().signal);

    expect(search).toHaveBeenCalledTimes(1);
    expect(second).toEqual([{ name: 'Spain' }]);
  });

  it('sends different queries separately', async () => {
    const search = vi.fn(async () => []);
    const cached = createCachedSearch(search);

    await cached('sp', newCaller().signal);
    await cached('spain', newCaller().signal);

    expect(search).toHaveBeenCalledTimes(2);
  });

  it('shares one in-flight request between concurrent identical queries', async () => {
    const { search, requests } = controllableSearch();
    const cached = createCachedSearch(search);

    const first = cached('spain', newCaller().signal);
    const second = cached('spain', newCaller().signal);
    expect(search).toHaveBeenCalledTimes(1);

    requests[0]!.resolve([{ name: 'Spain' }]);

    await expect(first).resolves.toEqual([{ name: 'Spain' }]);
    await expect(second).resolves.toEqual([{ name: 'Spain' }]);
  });

  it('one caller aborting does not break the request for the others', async () => {
    const { search, requests } = controllableSearch();
    const cached = createCachedSearch(search);
    const quitter = newCaller();

    const quitterPromise = cached('spain', quitter.signal);
    const stayerPromise = cached('spain', newCaller().signal);

    quitter.abort();

    await expect(quitterPromise).rejects.toMatchObject({ name: 'AbortError' });
    expect(requests[0]!.signal.aborted).toBe(false); // still running for the other caller

    requests[0]!.resolve([{ name: 'Spain' }]);
    await expect(stayerPromise).resolves.toEqual([{ name: 'Spain' }]);
  });

  it('aborts the shared request when the last caller leaves', async () => {
    const { search, requests } = controllableSearch();
    const cached = createCachedSearch(search);
    const a = newCaller();
    const b = newCaller();

    const pa = cached('spain', a.signal);
    const pb = cached('spain', b.signal);

    a.abort();
    expect(requests[0]!.signal.aborted).toBe(false);
    b.abort();
    expect(requests[0]!.signal.aborted).toBe(true);

    await expect(pa).rejects.toMatchObject({ name: 'AbortError' });
    await expect(pb).rejects.toMatchObject({ name: 'AbortError' });
  });

  it('starts a fresh request after the previous one was fully aborted', async () => {
    const { search, requests } = controllableSearch();
    const cached = createCachedSearch(search);
    const first = newCaller();

    const aborted = cached('spain', first.signal);
    first.abort();
    await expect(aborted).rejects.toMatchObject({ name: 'AbortError' });

    const again = cached('spain', newCaller().signal);
    expect(search).toHaveBeenCalledTimes(2);

    requests[1]!.resolve([{ name: 'Spain' }]);
    await expect(again).resolves.toEqual([{ name: 'Spain' }]);
  });

  it('does not cache failures, so a retry hits the network again', async () => {
    const { search, requests } = controllableSearch();
    const cached = createCachedSearch(search);

    const failing = cached('spain', newCaller().signal);
    requests[0]!.reject(new HttpError(500));
    await expect(failing).rejects.toBeInstanceOf(HttpError);

    const retry = cached('spain', newCaller().signal);
    expect(search).toHaveBeenCalledTimes(2);

    requests[1]!.resolve([{ name: 'Spain' }]);
    await expect(retry).resolves.toEqual([{ name: 'Spain' }]);
  });

  it('rejects at once for an already-aborted signal, without starting a request', async () => {
    const { search } = controllableSearch();
    const cached = createCachedSearch(search);
    const caller = newCaller();
    caller.abort();

    await expect(cached('spain', caller.signal)).rejects.toMatchObject({
      name: 'AbortError',
    });
    expect(search).not.toHaveBeenCalled();
  });
});
