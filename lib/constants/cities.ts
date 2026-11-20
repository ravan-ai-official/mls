/**
 * Cities the site browses by, in the product owner's order (the first eight
 * are the reference design's). Shared by /communities and the HTML sitemap so
 * the two never list different cities. The bulk stats endpoint caps a request
 * at 20 cities.
 */
export const COMMUNITY_CITIES = [
  "Toronto",
  "Mississauga",
  "Vaughan",
  "Oakville",
  "Markham",
  "Milton",
  "Brampton",
  "Pickering",
  "Burlington",
  "Hamilton",
  "Richmond Hill",
  "Ajax",
] as const;

/** Extra GTA names the search bar should treat as a city filter, not free text. */
const EXTRA_SEARCH_CITIES = [
  "Whitby",
  "Oshawa",
  "Newmarket",
  "Aurora",
  "King City",
  "Caledon",
  "Halton Hills",
  "Georgina",
] as const;

const KNOWN_SEARCH_CITIES = [...COMMUNITY_CITIES, ...EXTRA_SEARCH_CITIES];

/**
 * Exact city match for the listings search box ("brampton" → "Brampton").
 * Returns null when the term is not a known city name.
 */
export function matchKnownCity(term: string): string | null {
  const normalized = term.trim().toLowerCase().replace(/\s+/g, " ");
  if (!normalized) return null;
  return KNOWN_SEARCH_CITIES.find((city) => city.toLowerCase() === normalized) ?? null;
}
