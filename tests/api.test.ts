import { afterEach, describe, expect, it, vi } from 'vitest';
import { searchCountries } from '../src/api.js';
import { HttpError } from '../src/errors.js';
import { mockFetch } from './helpers.js';

afterEach(() => vi.unstubAllGlobals());

const freshSignal = () => new AbortController().signal;

describe('searchCountries', () => {
  it('returns the array from the response', async () => {
    mockFetch(() => ({ delay: 0, body: [{ name: 'Spain' }] }));
    await expect(searchCountries('spain', freshSignal())).resolves.toEqual([
      { name: 'Spain' },
    ]);
  });

  it('encodes the query into the URL', async () => {
    const { fn } = mockFetch(() => ({ delay: 0 }));
    await searchCountries('côte d/ivoire', freshSignal());
    expect(fn.mock.calls[0]![0]).toBe(
      `https://countries.dev/name/${encodeURIComponent('côte d/ivoire')}`,
    );
  });

  it('404 means "no matches": resolves with [] (the body is plain text, not JSON)', async () => {
    mockFetch(() => ({ delay: 0, status: 404, body: 'Country not found' }));
    await expect(searchCountries('zzz', freshSignal())).resolves.toEqual([]);
  });

  it.each([400, 500, 503])(
    'status %i throws HttpError with that status',
    async (status) => {
      mockFetch(() => ({ delay: 0, status, body: 'oops' }));
      const promise = searchCountries('x', freshSignal());
      await expect(promise).rejects.toBeInstanceOf(HttpError);
      await expect(promise).rejects.toMatchObject({ status });
    },
  );

  it('lets network failures through untouched', async () => {
    vi.stubGlobal('fetch', () => Promise.reject(new TypeError('Failed to fetch')));
    await expect(searchCountries('x', freshSignal())).rejects.toBeInstanceOf(TypeError);
  });

  it('aborting the caller signal rejects with AbortError', async () => {
    mockFetch(() => ({ delay: 10_000 }));
    const controller = new AbortController();
    const promise = searchCountries('x', controller.signal);

    controller.abort();

    await expect(promise).rejects.toMatchObject({ name: 'AbortError' });
  });

  it('an already-aborted signal rejects with AbortError', async () => {
    mockFetch(() => ({ delay: 0 }));
    const controller = new AbortController();
    controller.abort();

    await expect(searchCountries('x', controller.signal)).rejects.toMatchObject({
      name: 'AbortError',
    });
  });

  it('a timeout rejects with TimeoutError, not AbortError', async () => {
    mockFetch(() => ({ delay: 10_000 }));
    await expect(
      searchCountries('x', freshSignal(), { timeoutMs: 20 }),
    ).rejects.toMatchObject({ name: 'TimeoutError' });
  });
});
