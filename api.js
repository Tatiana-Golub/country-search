import { HttpError } from './errors.js';
const BASE_URL = 'https://countries.dev/name/';
export const DEFAULT_TIMEOUT_MS = 8000;
function combineSignals(signals) {
    if (typeof AbortSignal.any === 'function')
        return AbortSignal.any(signals);
    const controller = new AbortController();
    for (const signal of signals) {
        if (signal.aborted) {
            controller.abort(signal.reason);
            break;
        }
        signal.addEventListener('abort', () => controller.abort(signal.reason), {
            once: true,
        });
    }
    return controller.signal;
}
export async function searchCountries(query, signal, { timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
    const combined = combineSignals([signal, AbortSignal.timeout(timeoutMs)]);
    const response = await fetch(BASE_URL + encodeURIComponent(query), {
        signal: combined,
    });
    if (response.status === 404)
        return [];
    if (!response.ok)
        throw new HttpError(response.status);
    const data = await response.json();
    return Array.isArray(data) ? data : [data];
}
