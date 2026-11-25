import type { ReactNode } from "react";
import Link from "next/link";
import { SafeImage } from "@/components/ui/SafeImage";
import type { AvmDetails, ValuationComp, ValuationResult } from "@/lib/api/valuation";
import { cn } from "@/lib/utils/cn";
import { EMPTY, formatDate, formatNumber, formatPrice } from "@/lib/utils/format";

/** WOWA targets at least five sold comps beside the subject. */
export const AVM_COMP_COLUMNS = 5;

type Column = { kind: "subject"; details: AvmDetails } | { kind: "comp"; comp: ValuationComp; details: AvmDetails };
type Row = { label: string; value: (column: Column) => ReactNode };

const dash = (value: ReactNode | null | undefined) =>
  value === null || value === undefined || value === "" ? EMPTY : value;
const yesNo = (value: boolean | null) => (value === null ? EMPTY : value ? "Y" : "N");
const num = (value: number | null, digits = 0) =>
  value === null ? null : value.toLocaleString("en-CA", { maximumFractionDigits: digits });
const pair = (a: ReactNode | null, b: ReactNode | null) =>
  a === null && b === null ? EMPTY : `${a ?? "—"}/${b ?? "—"}`;
const money = (value: number | null) => (value === null ? EMPTY : formatPrice(value));

/**
 * Comparison rows: client-requested listing fields first, then the remaining
 * AVM sample rows. Missing feed values render as a dash.
 */
const ROWS: Row[] = [
  { label: "Municipality", value: (c) => dash(c.details.city ?? (c.kind === "comp" ? c.comp.city : null)) },
  { label: "Community", value: (c) => dash(c.details.community) },
  { label: "Address", value: (c) => dash(c.details.address ?? (c.kind === "comp" ? c.comp.address : null)) },
  { label: "Level", value: (c) => dash(c.details.level) },
  { label: "Unit #", value: (c) => dash(c.details.unitNumber) },
  { label: "Locker", value: (c) => yesNo(c.details.locker) },
  {
    label: "POTL monthly fees (if applicable)",
    value: (c) => (c.details.potlMonthlyFees === null ? EMPTY : money(c.details.potlMonthlyFees)),
  },
  {
    label: "Maintenance",
    value: (c) => (c.details.maintenance === null ? EMPTY : money(c.details.maintenance)),
  },
  { label: "Included in maintenance costs", value: (c) => dash(c.details.maintenanceIncludes) },
  { label: "Property type", value: (c) => dash(c.details.propertyType) },
  { label: "Style", value: (c) => dash(c.details.propertyStyle) },
  { label: "Lot frontage", value: (c) => dash(c.details.frontageFt === null ? null : `${num(c.details.frontageFt, 2)} ft`) },
  { label: "Lot depth", value: (c) => dash(c.details.depthFt === null ? null : `${num(c.details.depthFt, 2)} ft`) },
  { label: "List price", value: (c) => money(c.details.listPrice) },
  { label: "Last sold price", value: (c) => money(c.details.lastSoldPrice) },
  { label: "Property taxes", value: (c) => money(c.details.taxAnnualAmount) },
  {
    label: "Days on market",
    value: (c) => dash(c.details.daysOnMarket === null ? null : String(c.details.daysOnMarket)),
  },
  {
    label: "Square feet above ground",
    value: (c) => dash(num(c.details.aboveGradeSqft ?? c.details.floorAreaSqft)),
  },
  { label: "Garage parking spaces", value: (c) => dash(num(c.details.garageSpaces)) },
  { label: "Total parking spaces", value: (c) => dash(num(c.details.parkingTotal)) },
  { label: "Year built", value: (c) => dash(c.details.yearBuilt === null ? null : String(c.details.yearBuilt)) },
  {
    label: "Number of bedrooms",
    value: (c) => {
      const { bedrooms, bedroomsBelowGrade } = c.details;
      if (bedrooms === null) return EMPTY;
      return bedroomsBelowGrade ? `${bedrooms} + ${bedroomsBelowGrade}` : String(bedrooms);
    },
  },
  {
    label: "Number of washrooms",
    value: (c) => pair(num(c.details.bathroomsFull), num(c.details.bathroomsHalf)),
  },
  { label: "Family room", value: (c) => yesNo(c.details.familyRoom) },
  { label: "Basement (finished/unfinished)", value: (c) => dash(c.details.basement) },
  { label: "Number of kitchens", value: (c) => dash(num(c.details.kitchens)) },
  { label: "Rental items under contract", value: (c) => dash(c.details.rentalItems) },

  // Remaining AVM sample fields not covered above.
  { label: "Roll Number", value: (c) => dash(c.details.rollNumber) },
  {
    label: "Sale Price",
    value: (c) =>
      c.kind === "subject" ? (
        "Subject"
      ) : (
        <>
          {formatPrice(c.comp.closePrice ?? c.comp.price)}
          <span className="block text-caption text-ink-subtle">
            {c.comp.source === "sold_proxy" ? "Last asking (off market)" : "Sold (close price)"}
          </span>
        </>
      ),
  },
  {
    label: "Sale Date (yyyy-mm-dd)",
    value: (c) =>
      c.kind === "subject" ? (
        EMPTY
      ) : (
        <>
          {dash(c.comp.eventDate)}
          {c.comp.eventDate && (
            <span className="block text-caption text-ink-subtle">
              {c.comp.source === "sold_proxy" ? "Left market" : "Closed"}
            </span>
          )}
        </>
      ),
  },
  { label: "Province", value: (c) => dash(c.details.province) },
  { label: "Postal Code", value: (c) => dash(c.details.postalCode) },
  {
    label: "Site Area (A)",
    value: (c) => {
      if (c.details.lotArea === null) return EMPTY;
      const units = c.details.lotAreaUnits ? ` ${c.details.lotAreaUnits}` : "";
      return `${num(c.details.lotArea, 2)}${units}`;
    },
  },
  { label: "Total Floor Area (sqft)", value: (c) => dash(num(c.details.floorAreaSqft)) },
  {
    label: "Total/Finished Basement Area (sqft)",
    value: (c) => {
      const total = num(c.details.basementTotalSqft);
      const finished = num(c.details.basementFinishedSqft);
      if (total === null && finished === null) return EMPTY;
      return pair(total, finished);
    },
  },
  {
    label: "Full/Partial Storeys",
    value: (c) => (c.details.storeys === null ? EMPTY : `${num(c.details.storeys)}/—`),
  },
  { label: "Structure Condition", value: (c) => dash(c.details.structureCondition) },
  { label: "No. Fireplaces", value: (c) => dash(num(c.details.fireplaces)) },
  {
    label: "Renovation Year/Type",
    value: (c) =>
      pair(
        c.details.renovationYear === null ? null : String(c.details.renovationYear),
        c.details.renovationType,
      ),
  },
  { label: "Heating Type", value: (c) => dash(c.details.heating) },
  { label: "Air Conditioning", value: (c) => yesNo(c.details.airConditioning) },
  { label: "Inground Pool", value: (c) => yesNo(c.details.pool) },
  {
    label: "Garage Type/Area",
    value: (c) => {
      const type = c.details.garageType ?? c.details.parkingFeatures;
      const area = c.details.garageArea !== null ? num(c.details.garageArea) : null;
      if (!type && area === null) return EMPTY;
      if (!type) return String(area);
      if (area === null) return type;
      return `${type}/${area}`;
    },
  },
];

/**
 * The home evaluation as an AVM report (scope #10): a details strip, then the
 * subject beside its three closest comparables, row by row. Scrolls sideways
 * on narrow screens; the first column stays pinned.
 */
export function AvmReport({ result }: { result: ValuationResult }) {
  // Sold comparison table: sold + sold_proxy only — never fall back to for-sale rows.
  const soldComps = [
    ...result.comps.filter((c) => c.source === "sold"),
    ...result.comps.filter((c) => c.source === "sold_proxy"),
  ].slice(0, AVM_COMP_COLUMNS);
  const columns: Column[] = [
    { kind: "subject", details: result.subjectDetails },
    ...soldComps.map((comp) => ({ kind: "comp" as const, comp, details: comp.details })),
  ];
  const anyProxy = soldComps.some((comp) => comp.source === "sold_proxy");
  // For-sale suggestions come only from active_comps (active_listing), never comps[].
  const active = result.activeComps
    .filter((c) => c.source === "active_listing")
    .slice(0, 5);
  const hedonic = result.breakdown.filter((b) => b.source !== "ai" && b.delta !== 0).slice(0, 8);
  const aiAdj = result.breakdown.filter((b) => b.source === "ai").slice(0, 8);

  return (
    <div className="space-y-6 lg:space-y-8">
      <section className="rounded-surface border border-line bg-surface p-5 sm:p-6 lg:p-8">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h3 className="text-h3 text-navy">How to read this estimate</h3>
            <p className="mt-1 max-w-2xl text-caption text-ink-muted">
              Four plain-language numbers from the automated valuation model
              (AVM). This is a market guide, not a formal appraisal.
            </p>
          </div>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <InsightCard
            label="Estimated market value"
            value={formatPrice(result.market)}
            hint="Best single-number estimate from nearby solds and local trends."
          />
          <InsightCard
            label="Likely selling range"
            value={`${formatPrice(result.low)} – ${formatPrice(result.high)}`}
            hint="Where a sale is most likely if the market stays similar."
          />
          <InsightCard
            label="Confidence"
            value={
              <span className="inline-flex flex-wrap items-center gap-2">
                <Stars count={result.confidenceStars} />
                <span className="text-small font-medium text-ink">
                  {confidenceLabel(result)}
                </span>
              </span>
            }
            hint={confidenceHint(result)}
          />
          <InsightCard
            label="Estimate as of"
            value={formatDate(result.valuationDate)}
            hint="Date this model ran. Refresh later for a newer reading."
          />
        </div>

        {(result.quickSaleLow > 0 || result.quickSaleHigh > 0) && (
          <p className="mt-4 rounded-control border border-line bg-surface-alt/60 px-4 py-3 text-caption text-ink-muted">
            <span className="font-semibold text-ink">Faster-sale band: </span>
            {formatPrice(result.quickSaleLow)} – {formatPrice(result.quickSaleHigh)}. A
            quicker close often means pricing toward the lower end of the range.
          </p>
        )}
      </section>

      {(hedonic.length > 0 || aiAdj.length > 0) && (
        <section className="rounded-surface border border-line bg-surface p-5 sm:p-6 lg:p-8">
          <h3 className="text-h3 text-navy">Value adjustments</h3>
          <p className="mt-1 text-caption text-ink-muted">
            Feature deltas from sold comps
            {aiAdj.length > 0 ? " plus AI-suggested adjustments" : ""}.
          </p>
          <ul className="mt-4 grid gap-x-8 sm:grid-cols-2 lg:grid-cols-3">
            {[...hedonic, ...aiAdj].map((item) => (
              <li
                key={`${item.source}-${item.feature}`}
                className="flex items-start justify-between gap-4 border-b border-line py-2.5 text-small"
              >
                <div>
                  <p className="font-medium text-ink">{item.feature.replace(/_/g, " ")}</p>
                  {item.note && <p className="text-caption text-ink-muted">{item.note}</p>}
                  <p className="text-caption text-ink-subtle">
                    {item.source === "ai" ? "AI" : "Comparable model"}
                  </p>
                </div>
                <p className={item.delta >= 0 ? "text-positive" : "text-negative"}>
                  {item.delta >= 0 ? "+" : ""}
                  {formatPrice(item.delta)}
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="rounded-surface border border-line bg-surface p-5 sm:p-6 lg:p-8">
        <h3 className="text-h3 text-navy">Comparable information</h3>
        {soldComps.length === 0 ? (
          <p className="mt-3 text-small text-ink-muted">
            Not enough nearby solds to compare yet.
          </p>
        ) : (
          <>
            <p className="mt-1 text-caption text-ink-muted">
              Your home beside the {soldComps.length} closest sold comparables used in this
              estimate.
            </p>
            <div className="mt-4 overflow-x-auto rounded-control border border-line">
              <table className="w-full min-w-[960px] text-left text-small lg:min-w-full">
                <thead>
                  <tr className="bg-surface-alt">
                    <th
                      scope="col"
                      className="sticky left-0 z-10 bg-surface-alt px-3 py-2.5 text-caption font-semibold uppercase tracking-wide text-ink-muted"
                    >
                      <span className="sr-only">Feature</span>
                    </th>
                    {columns.map((column, index) => (
                      <th
                        key={index}
                        scope="col"
                        className={cn(
                          "px-3 py-2.5 text-caption font-semibold uppercase tracking-wide",
                          column.kind === "subject" ? "bg-navy text-white" : "text-ink-muted",
                        )}
                      >
                        {column.kind === "subject" ? "Your home" : `Comparable ${index}`}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {ROWS.map((row) => (
                    <tr key={row.label}>
                      <th
                        scope="row"
                        className="sticky left-0 z-10 whitespace-nowrap bg-surface-alt px-3 py-2 align-top text-caption font-semibold text-ink"
                      >
                        {row.label}
                      </th>
                      {columns.map((column, index) => (
                        <td
                          key={index}
                          className={cn(
                            "px-3 py-2 align-top text-ink-soft",
                            column.kind === "subject" && "bg-navy/5 font-medium text-ink",
                          )}
                        >
                          {row.value(column)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-3 text-caption text-ink-subtle">
              {anyProxy
                ? "“Last asking (off market)” is the final list price before a home left the market, not a confirmed sale price. "
                : ""}
              Dashes mark details the listing does not include.
            </p>
          </>
        )}
      </section>

      {active.length > 0 && (
        <section className="rounded-surface border border-line bg-surface p-5 sm:p-6 lg:p-8">
          <h3 className="text-h3 text-navy">Currently for sale</h3>
          <p className="mt-1 text-caption text-ink-muted">
            Similar homes for sale nearby — asking prices and days on market, not sold comps.
          </p>
          <ul className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            {active.map((comp) => (
              <li key={comp.listingKey ?? `${comp.address}-${comp.price}`}>
                <ActiveListingCard comp={comp} />
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function ActiveListingCard({ comp }: { comp: ValuationComp }) {
  const href = comp.listingKey ? `/property/${encodeURIComponent(comp.listingKey)}` : null;
  const facts = [
    comp.beds != null ? `${comp.beds} bed` : null,
    comp.baths != null ? `${comp.baths} bath` : null,
    comp.livingArea != null ? `${formatNumber(comp.livingArea)} sqft` : null,
  ].filter(Boolean);
  const body = (
    <>
      {comp.imageUrl ? (
        <div className="relative h-[140px] w-full shrink-0 bg-surface-alt">
          <SafeImage
            src={comp.imageUrl}
            alt={comp.address ? `Photo of ${comp.address}` : "Listing photo"}
            fill
            sizes="(max-width: 640px) 100vw, 20vw"
            className="object-cover transition-transform duration-300 group-hover:scale-[1.03]"
          />
        </div>
      ) : null}
      <div className="flex flex-1 flex-col p-4">
        <p className="line-clamp-2 text-small font-medium text-ink">
          {comp.address || "Nearby listing"}
        </p>
        {comp.city ? <p className="mt-0.5 text-caption text-ink-muted">{comp.city}</p> : null}
        {facts.length > 0 ? (
          <p className="mt-1 text-caption text-ink-muted">{facts.join(" · ")}</p>
        ) : null}
        <p className="mt-3 text-small font-semibold text-ink">
          {formatPrice(comp.listPrice ?? comp.price)}
        </p>
        <p className="mt-0.5 text-caption text-ink-muted">
          {comp.daysOnMarket != null ? `${comp.daysOnMarket} days on market` : "Active"}
        </p>
      </div>
    </>
  );

  const className =
    "group flex h-full flex-col overflow-hidden rounded-control border border-line bg-surface shadow-card transition-shadow hover:shadow-card-hover";

  if (href) {
    return (
      <Link href={href} className={className}>
        {body}
      </Link>
    );
  }
  return <article className={className}>{body}</article>;
}

function InsightCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: ReactNode;
  hint: string;
}) {
  return (
    <div className="rounded-control border border-line bg-surface-alt/40 px-4 py-4">
      <p className="text-[10px] font-semibold uppercase tracking-[1.2px] text-ink-muted">{label}</p>
      <div className="mt-2 text-[1.15rem] font-semibold leading-snug text-ink sm:text-h3">{value}</div>
      <p className="mt-2 text-caption leading-relaxed text-ink-muted">{hint}</p>
    </div>
  );
}

function confidenceLabel(result: ValuationResult): string {
  if (result.sparse) return "Low";
  if (result.confidence) return result.confidence;
  if (result.confidenceStars >= 4) return "High";
  if (result.confidenceStars >= 3) return "Medium";
  if (result.confidenceStars >= 1) return "Low";
  return "Limited";
}

function confidenceHint(result: ValuationResult): string {
  if (result.sparse) {
    return "Fewer than five nearby solds matched, so treat the number as indicative only.";
  }
  if (result.confidenceStars >= 4) {
    return "Strong local sold evidence. Still confirm with an agent before pricing.";
  }
  if (result.confidenceStars >= 3) {
    return "Decent sold coverage nearby. Useful as a guide, not a final list price.";
  }
  return "Thin sold evidence nearby. Ask an agent for a firmer CMA.";
}

function Stars({ count }: { count: number }) {
  const filled = Math.max(0, Math.min(5, Math.round(count)));
  return (
    <span role="img" aria-label={`${filled} out of 5 stars`} className="tracking-wider text-gold">
      {"★".repeat(filled)}
      <span className="text-line">{"★".repeat(5 - filled)}</span>
    </span>
  );
}
