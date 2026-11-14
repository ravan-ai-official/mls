import { SafeImage } from "@/components/ui/SafeImage";
import Link from "next/link";
import { cn } from "@/lib/utils/cn";
import { PropertyBadgePill } from "@/components/ui/Badge";
import { statusLabel } from "@/lib/api/mappers";
import {
  EMPTY,
  formatLeasePrice,
  formatNumber,
  formatPrice,
} from "@/lib/utils/format";
import type { PropertyDetail } from "@/lib/types/domain";

/**
 * Rows rendered in the comparison matrix, in display order.
 *
 * `numeric` marks rows where a "best" value is meaningful, so the cheapest
 * price or the largest floor area can be called out.
 */
export const COMPARE_ROWS: Array<{
  label: string;
  value: (p: PropertyDetail) => string;
  numeric?: (p: PropertyDetail) => number | null;
  lowerIsBetter?: boolean;
}> = [
  { label: "Municipality", value: (p) => p.community ?? EMPTY },
  { label: "Community", value: (p) => p.neighbourhood ?? EMPTY },
  { label: "Address", value: (p) => p.address || EMPTY },
  { label: "Ownership / Title", value: (p) => p.ownership ?? EMPTY },
  { label: "Level", value: (p) => p.level ?? EMPTY },
  { label: "Unit #", value: (p) => p.unitNumber ?? EMPTY },
  {
    label: "Locker",
    value: (p) => (p.locker === null ? EMPTY : p.locker ? "Yes" : "No"),
  },
  {
    label: "POTL monthly fees",
    value: (p) => (p.potlMonthlyFees === null ? EMPTY : formatPrice(p.potlMonthlyFees)),
    numeric: (p) => p.potlMonthlyFees,
    lowerIsBetter: true,
  },
  {
    label: "Maintenance",
    value: (p) =>
      p.associationFee === null
        ? EMPTY
        : `${formatPrice(p.associationFee)}${p.associationFeeFrequency ? ` / ${p.associationFeeFrequency.toLowerCase()}` : ""}`,
    numeric: (p) => p.associationFee,
    lowerIsBetter: true,
  },
  {
    label: "Included in maintenance costs",
    value: (p) => p.associationFeeIncludes ?? EMPTY,
  },
  { label: "Property type", value: (p) => p.type ?? EMPTY },
  { label: "Style", value: (p) => p.style ?? EMPTY },
  {
    label: "Lot frontage",
    value: (p) => (p.lotFrontage === null ? EMPTY : `${formatNumber(p.lotFrontage)} ft`),
    numeric: (p) => p.lotFrontage,
  },
  { label: "Lot depth", value: (p) => p.lotDepth ?? EMPTY },
  {
    label: "List price",
    value: (p) =>
      p.price === null ? EMPTY : p.isLease ? formatLeasePrice(p.price) : formatPrice(p.price),
    numeric: (p) => p.price,
    lowerIsBetter: true,
  },
  {
    label: "Last sold price",
    value: (p) =>
      p.closePrice === null
        ? EMPTY
        : p.isLease
          ? formatLeasePrice(p.closePrice)
          : formatPrice(p.closePrice),
    numeric: (p) => p.closePrice,
    lowerIsBetter: true,
  },
  {
    label: "Property taxes",
    value: (p) => (p.taxAnnualAmount === null ? EMPTY : formatPrice(p.taxAnnualAmount)),
    numeric: (p) => p.taxAnnualAmount,
    lowerIsBetter: true,
  },
  {
    label: "Days on market",
    value: (p) =>
      p.daysOnMarket === null
        ? EMPTY
        : `${p.daysOnMarket} day${p.daysOnMarket === 1 ? "" : "s"}`,
    numeric: (p) => p.daysOnMarket,
    lowerIsBetter: true,
  },
  {
    label: "Square footage",
    value: (p) => {
      const area = p.sqft ?? p.sqftAboveGrade;
      return area === null ? EMPTY : `${formatNumber(area)} sq ft`;
    },
    numeric: (p) => p.sqft ?? p.sqftAboveGrade,
  },
  {
    label: "Number of garages",
    value: (p) => (p.garageSpaces === null ? EMPTY : formatNumber(p.garageSpaces)),
    numeric: (p) => p.garageSpaces,
  },
  {
    label: "Total parking spaces",
    value: (p) => (p.parkingTotal === null ? EMPTY : formatNumber(p.parkingTotal)),
    numeric: (p) => p.parkingTotal,
  },
  { label: "Year built", value: (p) => (p.yearBuilt === null ? EMPTY : String(p.yearBuilt)) },
  {
    label: "Property age",
    value: (p) =>
      p.propertyAge === null
        ? EMPTY
        : `${p.propertyAge} year${p.propertyAge === 1 ? "" : "s"}`,
    numeric: (p) => p.propertyAge,
    lowerIsBetter: true,
  },
  {
    label: "Number of floors",
    value: (p) => (p.stories === null ? EMPTY : formatNumber(p.stories)),
    numeric: (p) => p.stories,
  },
  {
    label: "Number of bedrooms",
    value: (p) => p.bedsLabel ?? (p.beds === null ? EMPTY : formatNumber(p.beds)),
    numeric: (p) => p.beds,
  },
  {
    label: "Number of washrooms",
    value: (p) => (p.baths === null ? EMPTY : formatNumber(p.baths)),
    numeric: (p) => p.baths,
  },
  {
    label: "Family room",
    value: (p) => (p.familyRoom === null ? EMPTY : p.familyRoom ? "Yes" : "No"),
  },
  { label: "Basement (finished/unfinished)", value: (p) => p.basement ?? EMPTY },
  {
    label: "Number of kitchens",
    value: (p) => (p.kitchens === null ? EMPTY : formatNumber(p.kitchens)),
    numeric: (p) => p.kitchens,
  },
  { label: "Rental items under contract", value: (p) => p.rentalItems ?? EMPTY },
  { label: "Status", value: (p) => statusLabel(p.status) },
  { label: "MLS®", value: (p) => p.mls },
];

const LABEL_COL = "200px";
const COL = "minmax(200px, 1fr)";

/**
 * Side-by-side comparison.
 *
 * Follows HomeAtlasUI's CompareScreen: a row of property cards on top, then one
 * card-wrapped matrix beneath. Both share a single CSS grid template, so the
 * columns line up without the photo living inside a table header — which is
 * what stretched the images in the previous version.
 *
 * Rows whose values are identical are dimmed, and the best value in a numeric
 * row is flagged, so the page answers "what is actually different here?"
 * instead of leaving the reader to diff fourteen rows by eye.
 */
export function CompareTable({
  properties,
  onRemove,
  onAdd,
  canAdd = false,
}: {
  properties: PropertyDetail[];
  /** Renders a per-card remove control when provided. */
  onRemove?: (listingKey: string) => void;
  /** Renders a trailing "add another" slot when there is room. */
  onAdd?: () => void;
  canAdd?: boolean;
}) {
  const showAdd = canAdd && Boolean(onAdd);
  const count = properties.length + (showAdd ? 1 : 0);
  const columns = `${LABEL_COL} repeat(${count}, ${COL})`;
  // Narrower than this and the columns crush; scroll sideways instead.
  const minWidth = 200 + count * 200;

  return (
    <div className="overflow-x-auto pb-2">
      <div style={{ minWidth }}>
        {/* Header cards — the photo lives here, at a fixed aspect ratio. */}
        <div className="grid gap-4" style={{ gridTemplateColumns: columns }}>
          <div aria-hidden="true" />
          {properties.map((property) => (
            <article
              key={property.id}
              className="overflow-hidden rounded-surface border border-line bg-surface shadow-card"
            >
              <div className="relative aspect-[4/3] w-full bg-surface-alt">
                <SafeImage
                  src={property.image}
                  alt={`Photo of ${property.address}`}
                  fill
                  sizes="260px"
                  className="object-cover"
                />
                {property.badge && (
                  <PropertyBadgePill
                    badge={property.badge}
                    className="absolute left-2 top-2"
                  />
                )}
                {onRemove && (
                  <button
                    type="button"
                    onClick={() => onRemove(property.id)}
                    aria-label={`Remove ${property.address} from comparison`}
                    className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full border border-line bg-surface text-ink-subtle shadow-card transition-colors hover:text-ink"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <path
                        d="M18 6 6 18M6 6l12 12"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                      />
                    </svg>
                  </button>
                )}
              </div>

              <div className="p-4">
                <p className="text-h3 text-ink">
                  {property.price === null
                    ? EMPTY
                    : property.isLease
                      ? formatLeasePrice(property.price)
                      : formatPrice(property.price)}
                </p>
                <p className="mt-1 line-clamp-2 text-small font-medium text-ink">
                  {property.address}
                </p>
                <p className="mt-0.5 truncate text-caption text-ink-muted">
                  {[property.neighbourhood, property.community].filter(Boolean).join(", ") ||
                    EMPTY}
                </p>
                <Link
                  href={`/property/${encodeURIComponent(property.id)}`}
                  className="mt-3 flex h-9 w-full items-center justify-center rounded-control border border-line text-caption font-medium text-ink transition-colors hover:border-navy hover:text-navy"
                >
                  View listing →
                </Link>
              </div>
            </article>
          ))}

          {showAdd && (
            <button
              type="button"
              onClick={onAdd}
              className="flex min-h-[220px] flex-col items-center justify-center gap-2 rounded-surface border border-dashed border-line text-ink-muted transition-colors hover:border-navy hover:text-navy"
            >
              <span
                aria-hidden="true"
                className="flex h-9 w-9 items-center justify-center rounded-full border border-current text-h3 leading-none"
              >
                +
              </span>
              <span className="text-caption font-medium">Add a home</span>
            </button>
          )}
        </div>

        {/* Matrix */}
        <div className="mt-6 overflow-hidden rounded-surface border border-line bg-surface shadow-card">
          <dl className="divide-y divide-line">
            {COMPARE_ROWS.map((row) => {
              const values = properties.map(row.value);
              const allSame = values.every((value) => value === values[0]);

              // Flag a winner only where it means something: a numeric row,
              // more than one home, and values that genuinely differ.
              let bestIndex = -1;
              if (!allSame && row.numeric && properties.length > 1) {
                const nums = properties.map(row.numeric);
                const valid = nums.filter((n): n is number => n !== null);
                if (valid.length > 1) {
                  const target = row.lowerIsBetter
                    ? Math.min(...valid)
                    : Math.max(...valid);
                  bestIndex = nums.findIndex((n) => n === target);
                }
              }

              return (
                <div
                  key={row.label}
                  className="grid items-center gap-4 px-4 py-3 odd:bg-surface-alt/50"
                  style={{ gridTemplateColumns: columns }}
                >
                  <dt className="text-caption font-semibold uppercase tracking-wide text-ink-muted">
                    {row.label}
                  </dt>
                  {properties.map((property, index) => (
                    <dd
                      key={property.id}
                      className={cn(
                        "flex items-center gap-2 text-small",
                        // Identical values are context, not signal — dim them
                        // so the differing rows carry the eye.
                        allSame ? "text-ink-muted" : "font-medium text-ink",
                      )}
                    >
                      <span>{row.value(property)}</span>
                      {index === bestIndex && (
                        <span className="shrink-0 rounded-full bg-gold-soft px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-ink">
                          Best
                        </span>
                      )}
                    </dd>
                  ))}
                  {showAdd && <dd aria-hidden="true" />}
                </div>
              );
            })}
          </dl>
        </div>
      </div>
    </div>
  );
}
