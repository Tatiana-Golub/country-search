import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { debounce } from '../src/debounce.js';

describe('debounce', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('does not call fn before the delay has elapsed', () => {
    const fn = vi.fn();
    debounce(fn, 300)('a');

    vi.advanceTimersByTime(299);
    expect(fn).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(fn).toHaveBeenCalledWith('a');
  });

  it('resets the timer on each call and fires once with the last args', () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 300);

    debounced('s');
    vi.advanceTimersByTime(200);
    debounced('sp');
    vi.advanceTimersByTime(200);
    expect(fn).not.toHaveBeenCalled();

    vi.advanceTimersByTime(100);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith('sp');
  });

  it('cancel() drops the pending call', () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 100);

    debounced();
    debounced.cancel();
    vi.advanceTimersByTime(500);

    expect(fn).not.toHaveBeenCalled();
  });

  it('keeps separate timers for separate debounced functions', () => {
    const a = vi.fn();
    const b = vi.fn();

    debounce(a, 100)();
    debounce(b, 100)();
    vi.advanceTimersByTime(100);

    expect(a).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledTimes(1);
  });
});
