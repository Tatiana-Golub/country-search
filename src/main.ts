import { searchCountries } from './api.js';
import type { CountryView } from './mapper.js';
import { SearchController, type State } from './search-controller.js';

type Child = Node | string | null;

function buildElement<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: Partial<HTMLElementTagNameMap[K]> = {},
  ...children: Child[]
): HTMLElementTagNameMap[K] {
  const element = Object.assign(document.createElement(tag), props);
  element.append(...children.filter((c): c is Node | string => c !== null));
  return element;
}

const input = buildElement('input', {
  id: 'q',
  type: 'search',
  placeholder: 'Search a country…',
});
const statusBox = buildElement('div');
const list = buildElement('div');

document.body.append(
  buildElement('h1', {}, 'Country search'),
  buildElement('label', { htmlFor: 'q' }, 'Country name'),
  input,
  statusBox,
  list,
);

let closeOpenDetail: (() => void) | null = null;

function buildDetail(country: CountryView, onClose: () => void): HTMLElement {
  const row = (label: string, value: string) =>
    buildElement('p', {}, buildElement('strong', {}, `${label}: `), value || '—');

  return buildElement(
    'div',
    { className: 'detail' },
    buildElement('p', {}, country.description),
    row(
      'Area',
      country.area === null ? '' : `${country.area.toLocaleString('en-US')} km²`,
    ),
    row('Borders', country.borders.join(', ')),
    row('Languages', country.languages.join(', ')),
    row('Currency', country.currencies.join(', ')),
    buildElement('button', {
      textContent: 'Close',
      className: 'close-btn',
      onclick: onClose,
    }),
  );
}

function renderItem(country: CountryView): HTMLElement {
  const slot = buildElement('div');
  const card = buildElement(
    'button',
    { className: 'card' },
    country.flag ? buildElement('img', { src: country.flag, alt: '' }) : null,
    buildElement(
      'span',
      {},
      buildElement('strong', {}, country.name),
      buildElement('br'),
      `${country.capital} · ${country.region} · ${country.population.toLocaleString('en-US')}`,
    ),
  );
  card.setAttribute('aria-expanded', 'false');

  let isOpen = false;

  const close = () => {
    slot.replaceChildren();
    card.setAttribute('aria-expanded', 'false');
    isOpen = false;
    if (closeOpenDetail === close) closeOpenDetail = null;
  };

  card.onclick = () => {
    if (isOpen) return close();

    closeOpenDetail?.();
    slot.replaceChildren(buildDetail(country, close));
    card.setAttribute('aria-expanded', 'true');
    isOpen = true;
    closeOpenDetail = close;
    slot.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  };

  return buildElement('div', { className: 'item' }, card, slot);
}

function render(state: State): void {
  statusBox.replaceChildren();
  list.replaceChildren();
  closeOpenDetail = null;

  switch (state.status) {
    case 'idle':
      break;
    case 'loading':
      statusBox.append(
        buildElement(
          'div',
          { className: 'status loading', role: 'status' },
          `Searching “${state.query}”…`,
        ),
      );
      break;
    case 'empty':
      statusBox.append(
        buildElement(
          'div',
          { className: 'status empty' },
          `Nothing found for “${state.query}”. Try another name.`,
        ),
      );
      break;
    case 'error':
      statusBox.append(
        buildElement(
          'div',
          { className: 'status error', role: 'alert' },
          `${state.message} `,
          buildElement('button', {
            textContent: 'Retry',
            onclick: () => controller.retry(),
          }),
        ),
      );
      break;
    case 'results':
      list.append(...state.items.map(renderItem));
      break;
  }
}

const controller = new SearchController(searchCountries, render);
input.addEventListener('input', () => controller.input(input.value));
