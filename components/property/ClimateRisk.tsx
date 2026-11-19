import type { ClimateRiskItem, ClimateRiskLevel } from "@/lib/api/climate";

type RiskLevel = ClimateRiskLevel;

interface DisplayRisk extends ClimateRiskItem {
  tone: string;
}

const LEVEL_TONE: Record<RiskLevel, string> = {
  Low: "bg-green-100 text-green-700",
  Medium: "bg-orange-100 text-orange-700",
  High: "bg-red-100 text-red-700",
};

/** Precipitation keeps the blue chip from the reference UI. */
function toneFor(risk: string, level: RiskLevel): string {
  if (risk.toLowerCase().includes("precip")) {
    if (level === "Low") return "bg-blue-50 text-blue-700";
    if (level === "High") return "bg-blue-200 text-blue-900";
    return "bg-blue-100 text-blue-700";
  }
  return LEVEL_TONE[level];
}

export function ClimateRisk({
  risks,
  source,
}: {
  risks: ClimateRiskItem[];
  source?: string;
}) {
  if (!risks.length) return null;

  const items: DisplayRisk[] = risks.map((item) => ({
    ...item,
    tone: toneFor(item.risk, item.level),
  }));

  return (
    <section className="rounded-surface border border-line bg-surface p-4 sm:p-6">
      <h2 className="mb-1 text-[18px] font-semibold text-ink">Climate Risk</h2>
      <p className="mb-4 text-small text-ink-muted">
        Projected hazards for this property by 2050
      </p>
      <div className="space-y-3">
        {items.map((item) => (
          <div key={item.risk} className="rounded-control bg-surface-alt p-4">
            <div className="mb-1 flex flex-wrap items-center gap-2">
              <span className="text-small font-semibold text-ink">{item.risk}</span>
              <span
                className={`rounded-full px-2 py-0.5 text-caption font-semibold ${item.tone}`}
              >
                {item.level}
              </span>
            </div>
            <p className="text-caption text-ink-muted">{item.desc}</p>
          </div>
        ))}
      </div>
      <p className="mt-3 text-caption text-ink-subtle">
        Source: {source ?? "Open-Meteo CMIP6"}
      </p>
    </section>
  );
}
