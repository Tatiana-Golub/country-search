import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { searchCountries } from '../src/api.js';
import { SearchController, type State } from '../src/search-controller.js';
import { mockFetch } from './helpers.js';

function setup(route: Parameters<typeof mockFetch>[0]) {
  const net = mockFetch(route);
  const states: State[] = [];
  const controller = new SearchController(searchCountries, (s) => states.push(s));
  return { ...net, states, controller, last: () => states.at(-1) };
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('race condition: stale responses', () => {
  it('a slow "sp" never overwrites a fast "spain", because it is aborted', async () => {
    const t = setup((url) =>
      url.endsWith('/sp')
        ? { delay: 1000, body: [{ name: 'Spratly Islands' }] }
        : { delay: 50, body: [{ name: 'Spain' }] },
    );

    t.controller.input('sp');
    await vi.advanceTimersByTimeAsync(300);
    t.controller.input('spain');
    expect(t.calls[0]!.signal.aborted).toBe(true);

    await vi.advanceTimersByTimeAsync(300);
    await vi.advanceTimersByTimeAsync(2000);

    expect(t.last()).toMatchObject({
      status: 'results',
      query: 'spain',
      items: [{ name: 'Spain' }],
    });
    expect(t.states.some((s) => s.status === 'results' && s.query === 'sp')).toBe(false);
    expect(t.states.some((s) => s.status === 'error')).toBe(false);
  });

  it('typing during the debounce wait aborts the request already in flight', async () => {
    const t = setup(() => ({ delay: 1000, body: [{ name: 'Spain' }] }));

    t.controller.input('sp');
    await vi.advanceTimersByTimeAsync(300);
    expect(t.calls[0]!.signal.aborted).toBe(false);

    t.controller.input('spa');
    expect(t.calls[0]!.signal.aborted).toBe(true);
    expect(t.calls).toHaveLength(1);
  });

  it('clearing the field aborts, goes idle, and sends nothing more', async () => {
    const t = setup(() => ({ delay: 1000 }));

    t.controller.input('sp');
    await vi.advanceTimersByTimeAsync(300);
    t.controller.input('');

    expect(t.calls[0]!.signal.aborted).toBe(true);
    await vi.advanceTimersByTimeAsync(5000);
    expect(t.last()).toEqual({ status: 'idle' });
    expect(t.calls).toHaveLength(1);
  });

  it('a 404 becomes "empty", not an error', async () => {
    const t = setup(() => ({ delay: 10, status: 404, body: 'Country not found' }));

    t.controller.input('zzz');
    await vi.advanceTimersByTimeAsync(400);

    expect(t.last()).toEqual({ status: 'empty', query: 'zzz' });
  });

  it('a 500 becomes an error, and retry() re-sends the last query', async () => {
    let failing = true;
    const t = setup(() =>
      failing
        ? { delay: 10, status: 500, body: 'oops' }
        : { delay: 10, body: [{ name: 'Spain' }] },
    );

    t.controller.input('spain');
    await vi.advanceTimersByTimeAsync(400);
    expect(t.last()).toMatchObject({ status: 'error', kind: 'http', query: 'spain' });

    failing = false;
    t.controller.retry();
    await vi.advanceTimersByTimeAsync(50);

    expect(t.last()).toMatchObject({ status: 'results', query: 'spain' });
    expect(t.calls.at(-1)!.url).toContain('/spain');
  });
});
