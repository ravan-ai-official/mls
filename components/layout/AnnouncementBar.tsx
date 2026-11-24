import Link from "next/link";

/**
 * Looping announcement marquee.
 *
 * The reference hardcoded live-sounding figures ("2,300+ Active MLS Listings",
 * "Prices Up 3.2% Month-Over-Month"). Those are market claims we cannot source
 * from the backend today — `catalog-stats/` is per-city and covers active
 * listings only (see API_GAPS G3) — so the copy here is evergreen and makes no
 * numeric claim. Pass `stats` once a bulk endpoint exists.
 */
const ITEMS: Array<{ text: string; cta?: { label: string; href: string } }> = [
  {
    text: "New pre-construction projects released this week",
    cta: { label: "View projects", href: "/preconstruction" },
  },
  { text: "MLS® listings updated daily across the GTA" },
  {
    text: "Track price movements in your neighbourhood",
    cta: { label: "See trends", href: "/market-trends" },
  },
  {
    text: "Free, no-obligation home evaluation",
    cta: { label: "Get your estimate", href: "/home-evaluation" },
  },
  { text: "VIP pre-construction access before public launch" },
];

export function AnnouncementBar({
  items = ITEMS,
}: {
  items?: Array<{ text: string; cta?: { label: string; href: string }; label?: string; href?: string }>;
}) {
  const lines = items.map((item) => ({
    text: item.text,
    cta: item.cta || (item.label && item.href ? { label: item.label, href: item.href } : undefined),
  }));
  return (
    <div className="flex h-9 w-full items-center overflow-hidden bg-navy">
      {/* aria-hidden: the duplicated track would read twice; links repeat in nav. */}
      <div className="marquee-track" aria-hidden="true">
        {[0, 1].map((pass) => (
          <div key={pass} className="flex items-center">
            {lines.map((item, index) => (
              <span key={`${pass}-${index}`} className="flex items-center gap-3 whitespace-nowrap pr-10">
                <StarGlyph />
                <span className="text-[0.6875rem] text-white/85">{item.text}</span>
                {item.cta && (
                  <Link
                    href={item.cta.href}
                    tabIndex={pass === 0 ? 0 : -1}
                    className="text-[0.6875rem] font-semibold text-gold hover:underline"
                  >
                    {item.cta.label} →
                  </Link>
                )}
                <span className="mx-4 select-none text-white/20">|</span>
              </span>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function StarGlyph() {
  return (
    <svg width="9" height="9" viewBox="0 0 10.52 10.03" fill="none" className="shrink-0" aria-hidden="true">
      <path
        d="M10.5234 3.84375L7.27734 6.22266L8.49609 10.0312L5.27344 7.6875L2.05078 9.97266L3.24609 6.22266L0 3.84375H4.03125L5.27344 0L6.50391 3.84375H10.5234V3.84375"
        fill="var(--color-gold)"
      />
    </svg>
  );
}
