import { debounce } from './debounce.js';
import { classifyError } from './errors.js';
import { mapCountriesResponse } from './mapper.js';
const ERROR_MESSAGES = {
    timeout: 'The server took too long to respond.',
    http: 'The server returned an error.',
    network: 'Network problem. Check your connection.',
};
export const DEFAULT_DEBOUNCE_MS = 300;
export class SearchController {
    search;
    onState;
    controller;
    lastQuery = '';
    scheduleSearch;
    constructor(search, onState, debounceMs = DEFAULT_DEBOUNCE_MS) {
        this.search = search;
        this.onState = onState;
        this.scheduleSearch = debounce((query) => void this.run(query), debounceMs);
    }
    input(text) {
        this.abortInFlight();
        const query = text.trim();
        this.lastQuery = query;
        if (!query) {
            this.scheduleSearch.cancel();
            this.onState({ status: 'idle' });
            return;
        }
        this.onState({ status: 'loading', query });
        this.scheduleSearch(query);
    }
    searchNow(text) {
        this.input(text);
        this.scheduleSearch.cancel();
        if (this.lastQuery)
            void this.run(this.lastQuery);
    }
    retry() {
        this.searchNow(this.lastQuery);
    }
    abortInFlight() {
        this.controller?.abort();
        this.controller = undefined;
    }
    async run(query) {
        this.abortInFlight();
        const controller = new AbortController();
        this.controller = controller;
        try {
            const raw = await this.search(query, controller.signal);
            if (controller.signal.aborted)
                return;
            const items = mapCountriesResponse(raw);
            this.onState(items.length ? { status: 'results', query, items } : { status: 'empty', query });
        }
        catch (error) {
            const kind = classifyError(error);
            if (kind === 'aborted')
                return;
            this.onState({ status: 'error', query, kind, message: ERROR_MESSAGES[kind] });
        }
        finally {
            if (this.controller === controller)
                this.controller = undefined;
        }
    }
}
