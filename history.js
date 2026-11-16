const STORAGE_KEY = 'country-search-history';
export const DEFAULT_HISTORY_LIMIT = 8;
const isSameQuery = (a, b) => a.trim().toLowerCase() === b.trim().toLowerCase();
export function loadHistory(storage) {
    try {
        const parsed = JSON.parse(storage.getItem(STORAGE_KEY) ?? '[]');
        return Array.isArray(parsed)
            ? parsed.filter((item) => typeof item === 'string')
            : [];
    }
    catch {
        return [];
    }
}
export function addToHistory(storage, query, limit = DEFAULT_HISTORY_LIMIT) {
    const entry = query.trim();
    const current = loadHistory(storage);
    if (!entry)
        return current;
    const next = [entry, ...current.filter((item) => !isSameQuery(item, entry))].slice(0, limit);
    try {
        storage.setItem(STORAGE_KEY, JSON.stringify(next));
    }
    catch {
        // Private mode or full quota: history is a convenience, so a failed save must not break search
    }
    return next;
}
