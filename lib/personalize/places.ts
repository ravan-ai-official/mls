/**
 * First-party recent places for homepage personalization.
 *
 * Written on search (city filter / AI city / hero location). Read on SSR for
 * Featured + Schools. No browser geolocation permission required.
 */

export const PLACES_COOKIE = "ha_places";
const MAX_PLACES = 5;
const MAX_AGE_SECONDS = 60 * 60 * 24 * 90;

/** Known GTA (and nearby) cities — longer names first for matching. */
export const KNOWN_CITIES = [
  "Richmond Hill",
  "Mississauga",
  "Newmarket",
  "Toronto",
  "Brampton",
  "Vaughan",
  "Markham",
  "Oakville",
  "Pickering",
  "Burlington",
  "Ajax",
  "Whitby",
  "Oshawa",
  "Milton",
  "Aurora",
  "Hamilton",
  "Caledon",
] as const;

export function canonicalizePlace(raw: string | null | undefined): string | null {
  const text = (raw ?? "").trim().replace(/\+/g, " ");
  if (!text) return null;
  const low = text.toLowerCase();
  for (const city of KNOWN_CITIES) {
    if (city.toLowerCase() === low) return city;
  }
  for (const city of KNOWN_CITIES) {
    const needle = city.toLowerCase();
    if (low.includes(needle) || needle.includes(low)) return city;
  }
  return null;
}

export function parsePlacesCookie(value: string | null | undefined): string[] {
  if (!value) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const part of value.split("|")) {
    const city = canonicalizePlace(decodeURIComponent(part.trim()));
    if (!city) continue;
    const key = city.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(city);
    if (out.length >= MAX_PLACES) break;
  }
  return out;
}

export function serializePlacesCookie(cities: string[]): string {
  return cities
    .map((city) => canonicalizePlace(city))
    .filter((city): city is string => Boolean(city))
    .filter((city, index, all) => all.findIndex((row) => row.toLowerCase() === city.toLowerCase()) === index)
    .slice(0, MAX_PLACES)
    .map((city) => encodeURIComponent(city))
    .join("|");
}

/** Record a city the visitor searched. Safe to call from client components. */
export function rememberPlace(raw: string | null | undefined) {
  if (typeof document === "undefined") return;
  const city = canonicalizePlace(raw);
  if (!city) return;
  try {
    const match = document.cookie.match(new RegExp(`(?:^|; )${PLACES_COOKIE}=([^;]*)`));
    const existing = parsePlacesCookie(match ? decodeURIComponent(match[1]) : "");
    const next = [city, ...existing.filter((row) => row.toLowerCase() !== city.toLowerCase())].slice(
      0,
      MAX_PLACES,
    );
    const secure = typeof window !== "undefined" && window.location.protocol === "https:" ? "; Secure" : "";
    document.cookie = `${PLACES_COOKIE}=${serializePlacesCookie(next)}; Path=/; Max-Age=${MAX_AGE_SECONDS}; SameSite=Lax${secure}`;
  } catch {
    // Cookie / storage blocked — personalization simply stays on IP/default.
  }
}

/** Pull a known city out of free text (hero q, place labels). */
export function cityFromText(raw: string | null | undefined): string | null {
  const text = (raw ?? "").trim();
  if (!text) return null;
  const direct = canonicalizePlace(text);
  if (direct) return direct;
  const low = text.toLowerCase();
  for (const city of KNOWN_CITIES) {
    if (new RegExp(`\\b${city.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(low)) {
      return city;
    }
  }
  return null;
}
