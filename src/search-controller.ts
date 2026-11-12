import type { SearchFn } from './api.js';
import { debounce } from './debounce.js';
import { classifyError, type ErrorKind } from './errors.js';
import { mapCountriesResponse, type CountryView } from './mapper.js';

export type State =
  | { status: 'idle' }
  | { status: 'loading'; query: string }
  | { status: 'results'; query: string; items: CountryView[] }
  | { status: 'empty'; query: string }
  | {
      status: 'error';
      query: string;
      kind: Exclude<ErrorKind, 'aborted'>;
      message: string;
    };

const ERROR_MESSAGES = {
  timeout: 'The server took too long to respond.',
  http: 'The server returned an error.',
  network: 'Network problem. Check your connection.',
} as const;

export const DEFAULT_DEBOUNCE_MS = 300;

export class SearchController {
  private controller?: AbortController;
  private lastQuery = '';
  private readonly scheduleSearch;

  constructor(
    private readonly search: SearchFn,
    private readonly onState: (state: State) => void,
    debounceMs = DEFAULT_DEBOUNCE_MS,
  ) {
    this.scheduleSearch = debounce((query: string) => void this.run(query), debounceMs);
  }

  input(text: string): void {
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

  searchNow(text: string): void {
    this.input(text);
    this.scheduleSearch.cancel();
    if (this.lastQuery) void this.run(this.lastQuery);
  }

  retry(): void {
    this.searchNow(this.lastQuery);
  }

  private abortInFlight(): void {
    this.controller?.abort();
    this.controller = undefined;
  }

  private async run(query: string): Promise<void> {
    this.abortInFlight();
    const controller = new AbortController();
    this.controller = controller;

    try {
      const raw = await this.search(query, controller.signal);
      if (controller.signal.aborted) return;

      const items = mapCountriesResponse(raw);
      this.onState(
        items.length ? { status: 'results', query, items } : { status: 'empty', query },
      );
    } catch (error) {
      const kind = classifyError(error);
      if (kind === 'aborted') return;

      this.onState({ status: 'error', query, kind, message: ERROR_MESSAGES[kind] });
    } finally {
      if (this.controller === controller) this.controller = undefined;
    }
  }
}
