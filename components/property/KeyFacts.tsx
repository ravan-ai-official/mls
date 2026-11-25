import type { PropertyDetail, PropertyFact } from "@/lib/types/domain";
import type { ListingEngagement } from "@/lib/api/neighbourhood";

/** Listing Details card — Overview / More details two-column fact grids. */
export function KeyFacts({ groups }: { groups: PropertyDetail["factGroups"] }) {
  if (groups.length === 0) return null;

  return (
    <div className="overflow-hidden rounded-2xl border border-line">
      <div className="border-b border-line bg-surface-alt px-4 py-4 sm:px-6">
        <h2 className="text-[18px] font-semibold text-ink">Listing Details</h2>
      </div>
      {groups.map((group) => (
        <div key={group.title}>
          <div className="border-b border-line px-4 py-3 sm:px-6">
            <p className="text-[11px] font-semibold uppercase tracking-[1.5px] text-ink-subtle">
              {group.title}
            </p>
          </div>
          <div className="grid sm:grid-cols-2">
            <FactColumn facts={group.left} />
            <FactColumn facts={group.right} borderOnMobile />
          </div>
        </div>
      ))}
    </div>
  );
}

function FactColumn({
  facts,
  borderOnMobile = false,
}: {
  facts: PropertyFact[];
  /** Right column: top border on stacked mobile so columns separate cleanly. */
  borderOnMobile?: boolean;
}) {
  if (facts.length === 0) return <div className="hidden sm:block" />;
  return (
    <dl
      className={
        borderOnMobile
          ? "border-t border-line sm:border-t-0 sm:border-l sm:border-line"
          : undefined
      }
    >
      {facts.map((item) => (
        <div
          key={item.label}
          className="flex items-baseline justify-between gap-3 border-b border-line-soft px-4 py-3 text-[13px] sm:px-6"
        >
          <dt className="text-ink-muted">{item.label}</dt>
          <dd className="text-right font-medium text-ink">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}

/**
 * Demand slider from HomeAtlasUI. The marker is this listing's view band on
 * HomeAtlas (7 days), not a buyer's/seller's market index.
 */
export function MarketDemand({ engagement }: { engagement: ListingEngagement | null }) {
  if (!engagement) return null;
  const left = engagement.band === "low" ? "18%" : engagement.band === "high" ? "78%" : "50%";
  const label =
    engagement.band === "low"
      ? "Buyer's"
      : engagement.band === "high"
        ? "Balanced → Seller's"
        : "Balanced";

  return (
    <div className="rounded-2xl border border-line p-4 sm:p-6">
      <h2 className="mb-1 text-[18px] font-semibold text-ink">Market Demand</h2>
      <p className="mb-4 text-[13px] text-ink-muted">
        {engagement.views7d} {engagement.views7d === 1 ? "view" : "views"} of this listing on
        HomeAtlas in the last 7 days.
      </p>
      <div className="relative mb-3 h-3 rounded-full bg-line">
        <div className="absolute inset-0 rounded-full bg-gradient-to-r from-sky-400 via-yellow-400 to-red-500" />
        <div
          className="absolute top-1/2 h-5 w-5 -translate-y-1/2 rounded-full border-2 border-navy bg-white shadow-md"
          style={{ left: left }}
        />
      </div>
      <div className="flex justify-between text-[11px] text-ink-muted">
        <span>Buyer&apos;s Market</span>
        <span className="font-semibold text-navy">{label}</span>
        <span>Seller&apos;s Market</span>
      </div>
    </div>
  );
}
