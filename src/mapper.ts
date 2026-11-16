export interface CountryView {
  code: string;
  name: string;
  flag: string;
  capital: string;
  region: string;
  subregion: string;
  population: number;
  area: number | null;
  borders: string[];
  languages: string[];
  currencies: string[];
  description: string;
}

type Dict = Record<string, unknown>;

const NONE = '—';

const asDict = (v: unknown): Dict => (v && typeof v === 'object' ? (v as Dict) : {});
const asString = (v: unknown, fallback = ''): string =>
  typeof v === 'string' && v !== '' ? v : fallback;
const asNumber = (v: unknown): number | null => (typeof v === 'number' ? v : null);
const asList = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);

const formatCurrency = (c: unknown): string => {
  const { name, symbol } = asDict(c);
  return symbol ? `${asString(name)} (${asString(symbol)})` : asString(name);
};

export function mapCountryResponse(raw: unknown): CountryView {
  const r = asDict(raw);
  const flags = asDict(r.flags);
  const name = asString(r.name, NONE);
  const capital = asString(r.capital, NONE);
  const region = asString(r.region, NONE);
  const population = asNumber(r.population) ?? 0;

  return {
    code: asString(r.alpha3Code, name),
    name,
    flag: asString(flags.svg, asString(flags.png)),
    capital,
    region,
    subregion: asString(r.subregion),
    population,
    area: asNumber(r.area),
    borders: asList(r.borders).filter((b): b is string => typeof b === 'string'),
    languages: asList(r.languages)
      .map((l) => asString(asDict(l).name))
      .filter(Boolean),
    currencies: asList(r.currencies).map(formatCurrency).filter(Boolean),
    description: `${name} is a country in ${region}. Its capital is ${capital}, and its population is ${population.toLocaleString('en-US')}.`,
  };
}

export const mapCountriesResponse = (raw: unknown[]): CountryView[] =>
  raw.map(mapCountryResponse);
