# Design notes

## 1. How outdated requests are cancelled

### The mechanism

`SearchController.input()` runs on **every change of the input field**, and the first thing it does is call `abort()` on the request that is currently in flight. This happens before the empty-field check and before the debounce timer is considered.

Each request gets its **own** `AbortController` (`SearchController.run`), so aborting an old request can never affect a newer one. Inside `searchCountries`, the caller's signal is merged with `AbortSignal.timeout(ms)` through `AbortSignal.any` (with a manual fallback), so `fetch` receives one signal that fires for either reason. The abort reason is preserved, which gives two distinguishable errors:

| Cause                      | Error name     | What the user sees      |
| -------------------------- | -------------- | ----------------------- |
| New input or cleared field | `AbortError`   | Nothing                 |
| No response within 8 s     | `TimeoutError` | Error message and Retry |
| Bad status (not 404)       | `HttpError`    | Error message and Retry |
| Network down               | `TypeError`    | Error message and Retry |

`classifyError` (`src/errors.ts`) is the single place that makes this decision. Only a positively identified `AbortError` is silent. Everything unknown is shown, so a real bug can never hide behind a blank screen. A 404 never reaches the `catch` block: `searchCountries` turns it into an empty array, which the UI shows as a friendly "nothing found".

### Why not a "is this response current?" flag

A flag only hides the symptom:

- **The stale request still runs to completion.** It wastes bandwidth and server work, and it occupies one of the browser's few parallel connections per host, which slows down the request the user actually cares about.
- **Correctness depends on discipline.** Every code path must remember to check the flag. With abort, the stale promise _rejects_, so it cannot reach the rendering code at all.
- **It does not cover the debounce wait.** Aborting on every keystroke (not only when debounce fires) means a response for old text can never arrive and render beneath newer text.

The only extra check is `controller.signal.aborted` after `await` in `run`, which covers a response that resolved in the same tick as an abort. It reads the request's own signal, not a "who is latest" flag, so cancellation is still real: the browser drops the stale request, which shows as "(canceled)" in the Network tab.

### Verified by test

`tests/race.test.ts` uses a `fetch` mock that rejects with `signal.reason` when aborted. A slow `sp` response is scheduled to arrive after a fast `spain` one, and the test asserts that the `sp` request was aborted (not merely ignored), that no `sp` result was ever emitted, and that no error state appeared.

### Cache and deduplication (bonus)

`createCachedSearch` (`src/cache.ts`) lets concurrent identical queries share one promise, but **each caller keeps its own cancellation**. The shared request owns its own `AbortController`; a caller's abort only decrements a subscriber counter and rejects that caller's promise. The shared request is aborted only when the last subscriber leaves, and it is removed from the in-flight map _before_ aborting, so the next caller starts a fresh request instead of reusing a dead promise. Failures and cancelled requests are never cached.

## 2. Debounce delay: 300 ms

Typical gaps between keystrokes are 100 to 250 ms, so 300 ms waits for a short pause in typing without feeling slow.

- **Without debounce,** every keystroke becomes a request (`s`, `sp`, `spa`, ...). Aborting makes this correct, but it is still wasteful: a new connection and a server hit per key, and a flickering loading state.
- **With a much larger delay (for example 1500 ms),** the interface feels broken: the user stops typing and nothing happens.

Because aborting is independent of the debounce, the delay is purely a load-versus-latency trade-off and never a correctness issue. `DEFAULT_DEBOUNCE_MS` in `src/search-controller.ts` is the single place to tune it.

## 3. Complexity

### `mapCountryResponse` (`src/mapper.ts`)

For one record with L languages, C currencies and B borders, the function does a constant number of scalar reads plus one pass over each of the three arrays (`filter` or `map`), so the time is **O(L + C + B)**. All of these are small and bounded by the real world (a country has at most a few dozen entries), so this is effectively constant per country. For a list of n countries, `mapCountriesResponse` is **O(n · k)** where k is the average record size. Space is the same order, since the view model copies those arrays. The function is pure: no input mutation, no shared state.

### Cache and deduplication (`src/cache.ts`)

- Lookup and insert in the `Map` are **O(1)** on average, plus **O(m)** to normalize a query of length m (`trim`, `toLowerCase`).
- Joining or leaving an in-flight request is **O(1)**: a counter change and one event listener.
- Memory is **O(q)** for q distinct cached queries. It is unbounded, which is fine for a session-sized demo. A production version would add an LRU limit.

### History (`src/history.ts`)

`addToHistory` is **O(h)** for h entries, where h is capped at 8, so effectively constant.

## 4. Clean code principles and where they are applied

| Principle                               | Where                                                                                                                                                                                                                     |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Single responsibility**               | `debounce.ts` (timing only), `api.ts` (HTTP only), `errors.ts` (error taxonomy), `mapper.ts` (data shaping), `cache.ts` (reuse), `history.ts` (persistence), `search-controller.ts` (state machine), `main.ts` (DOM only) |
| **Pure functions**                      | `mapCountryResponse`, `classifyError`, `normalize` in `cache.ts`                                                                                                                                                          |
| **Dependency injection**                | `SearchController` receives `search` and `onState`; `createCachedSearch` takes and returns a `SearchFn`; `history.ts` takes the storage as a parameter. Tests inject fakes, so no browser or network is needed            |
| **Make illegal states unrepresentable** | `State` in `search-controller.ts` is a discriminated union, and `render` in `main.ts` is a `switch` over it                                                                                                               |
| **Intention-revealing names**           | `buildElement` (renamed from `h`), `closeOpenDetail`, `abortInFlight`, `isSameQuery`                                                                                                                                      |
| **No magic values**                     | `BASE_URL`, `DEFAULT_TIMEOUT_MS` (`api.ts`), `DEFAULT_DEBOUNCE_MS`, `ERROR_MESSAGES` (`search-controller.ts`), `NONE` (`mapper.ts`), `STORAGE_KEY` (`history.ts`)                                                         |
| **Fail loudly and specifically**        | `HttpError` with a `status` property instead of string errors; unknown errors default to "shown", never swallowed                                                                                                         |
| **Deliberate, documented exceptions**   | The empty `catch` in `addToHistory` is commented with why: a failed save must not break a successful search                                                                                                               |
| **Parse, don't trust**                  | `mapper.ts` treats API data as `unknown` and narrows it with small helpers (`asDict`, `asString`, ...); `loadHistory` filters stored values                                                                               |
| **Safe DOM**                            | `buildElement` in `main.ts` uses `append` and `textContent`; no `innerHTML` anywhere                                                                                                                                      |

## 5. Testing approach

All logic is DOM-independent and tested without a browser or a real network (`fetch` is mocked via `tests/helpers.ts`). Tests follow FIRST: fast (fake timers), isolated (each test builds its own instances), repeatable (no real network or clock), self-validating, and timely (each test commit precedes its implementation commit).
