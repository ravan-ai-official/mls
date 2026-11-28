"use client";

import { useRouter } from "next/navigation";
import { useState, type ReactNode, type FormEvent } from "react";
import { AiSearchBox, SparkleIcon } from "@/components/search/AiSearchBox";
import { Button } from "@/components/ui/Button";
import { SearchInput } from "@/components/ui/Field";
import {
  isHeroCountValue,
  isHeroIntentValue,
  isHeroPriceValue,
  isHeroPropertyTypeValue,
  readHeroOptions,
  type HeroIntentValue,
  type HeroOption,
} from "@/lib/site/heroFilters";
import { listOf } from "@/lib/site/read";
import { matchKnownCity } from "@/lib/constants/cities";
import { rememberLastSearch } from "@/lib/personalize/lastSearch";
import { cityFromText, rememberPlace } from "@/lib/personalize/places";
import { looksLikePostal, parsePostalList } from "@/lib/utils/postal";
import { parseListingSearch } from "@/lib/utils/searchParams";
import { cn } from "@/lib/utils/cn";

const DEFAULT_TRY_PROMPTS = [
  "3 bed condo under $900K near a subway in Toronto",
  "Family home in Oakville with a big backyard and double garage",
  "2 bedroom rental downtown under $3,000/month with parking",
  "Detached house in Vaughan with a basement apartment",
];

const DEFAULT_INTENTS: HeroOption[] = [
  { value: "buy", label: "For Sale" },
  { value: "rent", label: "Rent" },
  { value: "sold", label: "Sold" },
];

const DEFAULT_PROPERTY_TYPES: HeroOption[] = [
  { value: "Detached", label: "Detached" },
  { value: "Semi-Detached", label: "Semi-Detached" },
  { value: "Townhome", label: "Townhome" },
  { value: "Condo", label: "Condo" },
];

const DEFAULT_SALE_PRICES: HeroOption[] = [
  { value: "", label: "Price" },
  { value: "0-500000", label: "Under $500K" },
  { value: "500000-800000", label: "$500K – $800K" },
  { value: "800000-1200000", label: "$800K – $1.2M" },
  { value: "1200000-2000000", label: "$1.2M – $2M" },
  { value: "2000000-", label: "$2M+" },
];

const DEFAULT_RENT_PRICES: HeroOption[] = [
  { value: "", label: "Price" },
  { value: "0-2000", label: "Under $2,000/mo" },
  { value: "2000-3000", label: "$2,000 – $3,000/mo" },
  { value: "3000-4000", label: "$3,000 – $4,000/mo" },
  { value: "4000-", label: "$4,000+/mo" },
];

const DEFAULT_BED_OPTIONS: HeroOption[] = [
  { value: "", label: "Bedrooms" },
  { value: "1", label: "1+ beds" },
  { value: "2", label: "2+ beds" },
  { value: "3", label: "3+ beds" },
  { value: "4", label: "4+ beds" },
  { value: "5", label: "5+ beds" },
];

const DEFAULT_BATH_OPTIONS: HeroOption[] = [
  { value: "", label: "Bathrooms" },
  { value: "1", label: "1+ baths" },
  { value: "2", label: "2+ baths" },
  { value: "3", label: "3+ baths" },
  { value: "4", label: "4+ baths" },
  { value: "5", label: "5+ baths" },
];

const INTENT_QUERY: Record<HeroIntentValue, { status?: string; tx?: string }> = {
  buy: { status: "Active" },
  rent: { tx: "rent" },
  sold: { status: "Sold", tx: "sold" },
};

type HeroMode = "ai" | "filters";

/**
 * Hero search: AI search (a sentence → filters) or the classic filter form.
 * Both land on the same /listings URL-driven results page.
 */
export function HeroSearch({ content }: { content?: Record<string, unknown> } = {}) {
  const [mode, setMode] = useState<HeroMode>("ai");
  const tryPrompts = listOf<string>(content, "tryPrompts", DEFAULT_TRY_PROMPTS).filter(
    (prompt) => typeof prompt === "string" && prompt.trim().length > 0,
  );

  return (
    <div className="w-full max-w-[540px] rounded-surface bg-surface p-3.5 shadow-pop sm:p-6 lg:p-7">
      <div
        role="tablist"
        aria-label="Search mode"
        className="mb-3.5 grid grid-cols-2 gap-0.5 rounded-control bg-navy-tint p-0.5 ring-1 ring-navy/10 sm:mb-5"
      >
        {(
          [
            { value: "ai", label: "AI Search" },
            { value: "filters", label: "Filters" },
          ] as const
        ).map((tab) => {
          const active = mode === tab.value;
          return (
            <button
              key={tab.value}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setMode(tab.value)}
              className={cn(
                "flex h-8 items-center justify-center gap-1 rounded-control px-2 text-caption font-semibold transition-colors",
                active
                  ? "bg-navy text-white shadow-md"
                  : "text-navy/75 hover:text-navy",
              )}
            >
              {tab.value === "ai" && (
                <SparkleIcon className={active ? "text-gold" : "text-gold-deep"} />
              )}
              {tab.label}
            </button>
          );
        })}
      </div>

      {mode === "ai" ? (
        <div role="tabpanel">
          <div className="mb-3 sm:mb-4">
            <p className="text-small font-semibold text-ink">Describe the home you want</p>
            <p className="text-caption text-ink-muted">
              Plain English works — we turn it into filters you can adjust
            </p>
          </div>
          <AiSearchBox
            variant="hero"
            examples={tryPrompts.length > 0 ? tryPrompts : DEFAULT_TRY_PROMPTS}
          />
        </div>
      ) : (
        <div role="tabpanel">
          <FilterSearch content={content} />
        </div>
      )}
    </div>
  );
}

/**
 * The classic filter form.
 *
 * Every control writes a real query param that `parseListingParams` reads, so
 * the resulting /listings URL is shareable and the back button behaves. Option
 * lists come from Studio (hero content) with hard fallbacks.
 */
function FilterSearch({ content }: { content?: Record<string, unknown> }) {
  const router = useRouter();
  const intents = readHeroOptions(content, "intents", DEFAULT_INTENTS, isHeroIntentValue);
  const propertyTypes = readHeroOptions(
    content,
    "propertyTypes",
    DEFAULT_PROPERTY_TYPES,
    isHeroPropertyTypeValue,
  ).filter((row) => row.value);
  const salePrices = readHeroOptions(content, "salePrices", DEFAULT_SALE_PRICES, isHeroPriceValue);
  const rentPrices = readHeroOptions(content, "rentPrices", DEFAULT_RENT_PRICES, isHeroPriceValue);
  const bedOptions = readHeroOptions(content, "bedOptions", DEFAULT_BED_OPTIONS, isHeroCountValue);
  const bathOptions = readHeroOptions(content, "bathOptions", DEFAULT_BATH_OPTIONS, isHeroCountValue);

  const defaultIntent = (intents.find((row) => row.value === "buy")?.value ??
    intents[0]?.value ??
    "buy") as HeroIntentValue;

  const [intent, setIntent] = useState<HeroIntentValue>(defaultIntent);
  const [query, setQuery] = useState("");
  const [type, setType] = useState("");
  const [price, setPrice] = useState("");
  const [beds, setBeds] = useState("");
  const [baths, setBaths] = useState("");

  function buildHref() {
    const params = new URLSearchParams();
    const active = INTENT_QUERY[intent] ?? INTENT_QUERY.buy;

    const term = query.trim();
    if (term && looksLikePostal(term)) {
      params.set("postal_code", parsePostalList(term).codes.join(","));
    } else if (term) {
      const city = matchKnownCity(term);
      if (city) params.set("city", city);
      else params.set("search", term);
    }
    if (active.status) params.set("status", active.status);
    if (active.tx) params.set("transaction_type", active.tx);
    if (type) {
      const homeType: Record<string, string> = {
        Detached: "detached",
        "Semi-Detached": "semi",
        Townhome: "townhouse",
        Condo: "condo",
      };
      if (homeType[type]) params.set("home_type", homeType[type]);
      else params.set("type", type);
    }

    if (price) {
      const [min, max] = price.split("-");
      if (min) params.set("price_min", min);
      if (max) params.set("price_max", max);
    }
    if (beds) params.set("beds_min", beds);
    if (baths) params.set("baths_min", baths);

    const qs = params.toString();
    return qs ? `/listings?${qs}` : "/listings";
  }

  function rememberHeroSearch() {
    rememberPlace(cityFromText(query));
    const href = buildHref();
    const qs = href.includes("?") ? href.slice(href.indexOf("?") + 1) : "";
    if (qs) rememberLastSearch(parseListingSearch(qs));
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    rememberHeroSearch();
    router.push(buildHref());
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="mb-4">
        <p className="text-small font-semibold text-ink">Search listings</p>
        <p className="text-caption text-ink-muted">
          Filter live MLS® data by location, price, beds and baths
        </p>
      </div>

      <SearchInput
        size="lg"
        label="Search by city, neighbourhood, postal code or MLS® number"
        value={query}
        onValueChange={setQuery}
        placeholder="City, neighbourhood, postal code (L7A) or MLS®"
        className="mb-4"
      />

      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <HeroSelect
          label="Transaction type"
          value={intent}
          onChange={(value) => {
            if (!isHeroIntentValue(value)) return;
            if ((value === "rent") !== (intent === "rent")) setPrice("");
            setIntent(value);
          }}
        >
          {intents.map((item) => (
            <option key={item.value} value={item.value}>
              {item.value === "buy"
                ? "For Sale"
                : item.value === "rent"
                  ? "Rent"
                  : item.value === "sold"
                    ? "Sold"
                    : item.label}
            </option>
          ))}
        </HeroSelect>

        <HeroSelect label="Property type" value={type} onChange={setType}>
          <option value="">Property Type</option>
          {propertyTypes.map((item) => (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          ))}
        </HeroSelect>

        <HeroSelect label="Price range" value={price} onChange={setPrice}>
          {(intent === "rent" ? rentPrices : salePrices).map((item) => (
            <option key={`${item.value}-${item.label}`} value={item.value}>
              {item.label}
            </option>
          ))}
        </HeroSelect>

        <HeroSelect label="Bedrooms" value={beds} onChange={setBeds}>
          {bedOptions.map((item) => (
            <option key={`${item.value}-${item.label}`} value={item.value}>
              {item.label}
            </option>
          ))}
        </HeroSelect>

        <HeroSelect label="Bathrooms" value={baths} onChange={setBaths}>
          {bathOptions.map((item) => (
            <option key={`${item.value}-${item.label}`} value={item.value}>
              {item.label}
            </option>
          ))}
        </HeroSelect>

        <Button
          type="button"
          variant="secondary"
          onClick={() => {
            rememberHeroSearch();
            router.push(buildHref());
          }}
          className="h-11 justify-between rounded-control px-3.5 text-small font-normal"
        >
          More Filters
          <Chevron />
        </Button>
      </div>

      <Button type="submit" variant="dark" size="lg" block>
        Search Properties
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
          <path
            d="M3.75 9H14.25M9 3.75L14.25 9L9 14.25"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </Button>
    </form>
  );
}

function HeroSelect({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: ReactNode;
}) {
  return (
    <div className="relative">
      <select
        aria-label={label}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-11 w-full cursor-pointer appearance-none rounded-control border border-line bg-surface px-3.5 pr-8 text-small text-ink transition-colors hover:border-gold focus:border-navy/35 focus:outline-none focus:ring-2 focus:ring-navy/10"
      >
        {children}
      </select>
      <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-ink-muted">
        <Chevron />
      </span>
    </div>
  );
}

function Chevron() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M4 6L8 10L12 6"
        stroke="currentColor"
        strokeWidth="1.33"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
