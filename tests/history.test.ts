import { describe, expect, it } from 'vitest';
import { addToHistory, loadHistory } from '../src/history.js';

function fakeStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
  };
}

describe('loadHistory', () => {
  it('returns an empty list when nothing is stored', () => {
    expect(loadHistory(fakeStorage())).toEqual([]);
  });

  it('survives corrupted JSON', () => {
    const storage = fakeStorage({ 'country-search-history': '{not json' });
    expect(loadHistory(storage)).toEqual([]);
  });

  it('ignores stored values that are not an array of strings', () => {
    expect(loadHistory(fakeStorage({ 'country-search-history': '{"a":1}' }))).toEqual([]);
    expect(
      loadHistory(fakeStorage({ 'country-search-history': '["spain",42,null]' })),
    ).toEqual(['spain']);
  });
});

describe('addToHistory', () => {
  it('puts the newest query first', () => {
    const storage = fakeStorage();
    addToHistory(storage, 'spain');
    expect(addToHistory(storage, 'france')).toEqual(['france', 'spain']);
  });

  it('persists the list so loadHistory sees it', () => {
    const storage = fakeStorage();
    addToHistory(storage, 'spain');
    expect(loadHistory(storage)).toEqual(['spain']);
  });

  it('moves a repeated query to the front instead of duplicating it', () => {
    const storage = fakeStorage();
    addToHistory(storage, 'spain');
    addToHistory(storage, 'france');
    expect(addToHistory(storage, 'spain')).toEqual(['spain', 'france']);
  });

  it('treats queries that differ only by case or spaces as the same', () => {
    const storage = fakeStorage();
    addToHistory(storage, 'spain');
    expect(addToHistory(storage, '  Spain ')).toEqual(['Spain']);
  });

  it('ignores empty queries', () => {
    const storage = fakeStorage();
    addToHistory(storage, 'spain');
    expect(addToHistory(storage, '   ')).toEqual(['spain']);
  });

  it('keeps only the most recent entries up to the limit', () => {
    const storage = fakeStorage();
    ['a', 'b', 'c', 'd'].forEach((q) => addToHistory(storage, q, 3));
    expect(loadHistory(storage)).toEqual(['d', 'c', 'b']);
  });

  it('does not throw when storage refuses to save, and still returns the list', () => {
    const brokenStorage = {
      getItem: () => null,
      setItem: () => {
        throw new DOMException('Quota exceeded', 'QuotaExceededError');
      },
    };
    expect(addToHistory(brokenStorage, 'spain')).toEqual(['spain']);
  });
});
