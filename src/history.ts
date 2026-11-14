const STORAGE_KEY = 'country-search-history';
export const DEFAULT_HISTORY_LIMIT = 8;

type ReadableStorage = Pick<Storage, 'getItem'>;
type WritableStorage = Pick<Storage, 'getItem' | 'setItem'>;

const isSameQuery = (a: string, b: string): boolean =>
  a.trim().toLowerCase() === b.trim().toLowerCase();

export function loadHistory(storage: ReadableStorage): string[] {
  try {
    const parsed: unknown = JSON.parse(storage.getItem(STORAGE_KEY) ?? '[]');
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === 'string')
      : [];
  } catch {
    return [];
  }
}

export function addToHistory(
  storage: WritableStorage,
  query: string,
  limit = DEFAULT_HISTORY_LIMIT,
): string[] {
  const entry = query.trim();
  const current = loadHistory(storage);
  if (!entry) return current;

  const next = [entry, ...current.filter((item) => !isSameQuery(item, entry))].slice(
    0,
    limit,
  );

  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Private mode or full quota: history is a convenience, so a failed save must not break search
  }
  return next;
}
