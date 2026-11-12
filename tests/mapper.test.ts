import { describe, expect, it } from 'vitest';
import { mapCountriesResponse, mapCountryResponse } from '../src/mapper.js';
import { sparseRaw, spainRaw } from './fixtures.js';

describe('mapCountryResponse', () => {
  it('maps a full record to card data', () => {
    const country = mapCountryResponse(spainRaw);

    expect(country).toMatchObject({
      code: 'ESP',
      name: 'Spain',
      flag: 'https://flags.example/es.svg',
      capital: 'Madrid',
      region: 'Europe',
      population: 47000000,
      area: 505992,
      borders: ['AND', 'FRA', 'GIB', 'PRT', 'MAR'],
      languages: ['Spanish'],
      currencies: ['Euro (€)'],
    });
    expect(country.description).toContain('Spain');
    expect(country.description).toContain('Madrid');
  });

  it('falls back to the PNG flag when there is no SVG', () => {
    const raw = { ...spainRaw, flags: { png: 'https://flags.example/es.png' } };
    expect(mapCountryResponse(raw).flag).toBe('https://flags.example/es.png');
  });

  it('uses safe defaults for missing fields', () => {
    const country = mapCountryResponse(sparseRaw);

    expect(country).toMatchObject({
      name: 'Nowhere',
      flag: '',
      capital: '—',
      region: '—',
      population: 0,
      area: null,
      borders: [],
      languages: [],
      currencies: [],
    });
  });

  it('is pure: same input gives the same output and the input is not mutated', () => {
    const copy = structuredClone(spainRaw);

    expect(mapCountryResponse(spainRaw)).toEqual(mapCountryResponse(spainRaw));
    expect(spainRaw).toEqual(copy);
  });
});

describe('mapCountriesResponse', () => {
  it('maps every item of the list, keeping order', () => {
    const names = mapCountriesResponse([spainRaw, sparseRaw]).map((c) => c.name);
    expect(names).toEqual(['Spain', 'Nowhere']);
  });
});
