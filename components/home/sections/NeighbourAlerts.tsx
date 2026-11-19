import Link from "next/link";
import { Badge, Eyebrow, type BadgeTone } from "@/components/ui/Badge";
import { SafeImage } from "@/components/ui/SafeImage";
import { WhatsappLink } from "@/components/providers/WhatsappProvider";
import { getNeighbourActivity } from "@/lib/api/home";
import type { NeighbourActivityEvent, NeighbourActivityItem } from "@/lib/api/homeMappers";
import { neighbourAlertPoints } from "@/lib/home/contentSections";
import { getVisitorPersonalization } from "@/lib/personalize/visitorContext";
import { headingLines, listOf, textOf } from "@/lib/site/read";
import { formatPriceCompact } from "@/lib/utils/format";
import { CheckDot } from "./contentIcons";
import { NeighbourAlertsCta } from "./NeighbourAlertsCta";
import { WhatsAppGlyph } from "./sectionIcons";

/**
 * "When Your Neighbours Are Selling" — live mixed activity cards prefer the
 * visitor's search-history / IP cities. Heading + bullets stay CMS-editable.
 */

const EVENT_TONES: Record<NeighbourActivityEvent, BadgeTone> = {
  "Just Listed": "navy",
  "Price Drop": "dark",
  "Open House": "warm",
  "Just Sold": "gold",
};

export async function NeighbourAlerts({ content }: { content?: Record<string, unknown> }) {
  const title = textOf(content, "title", "When Your Neighbours\nAre Selling");
  const bullets = listOf<string>(content, "bullets", neighbourAlertPoints);
  const visitor = await getVisitorPersonalization();
  const items = await getNeighbourActivity(4, {
    cities: visitor.cities,
    headers: visitor.headers,
    cache: "no-store",
  });

  return (
    <section className="bg-surface py-10 sm:py-14 lg:py-16">
      <div className="container-page grid items-center gap-10 lg:grid-cols-2">
        <div>
          <Eyebrow>{textOf(content, "eyebrow", "For renters & neighbours")}</Eyebrow>
          <h2 className="mt-3 text-display text-ink">
            {headingLines(title).map((line, index) => (
              <span key={line}>
                {index > 0 && <br />}
                {line}
              </span>
            ))}
          </h2>
          <p className="mt-4 text-body text-ink-muted">
            {textOf(
              content,
              "description",
              "Stay informed about listings near you. Whether you're renting and your landlord is selling, or you're a homeowner tracking your street's value — HomeAtlas keeps you in the loop with instant alerts when nearby homes hit the market.",
            )}
          </p>

          <ul className="mt-6 space-y-3">
            {bullets.map((item) => (
              <li key={item} className="flex items-start gap-3">
                <CheckDot />
                <span className="text-small text-ink">{item}</span>
              </li>
            ))}
          </ul>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
            <NeighbourAlertsCta />
            <WhatsappLink
              message={textOf(
                content,
                "whatsappMessage",
                "Hi, I'd like to know when homes near me are listed.",
              )}
              className="inline-flex h-12 items-center justify-center gap-2 rounded-control border border-navy px-5 text-small font-semibold text-navy transition-colors hover:bg-navy hover:text-white"
            >
              <WhatsAppGlyph />
              Ask on WhatsApp
            </WhatsappLink>
          </div>
        </div>

        <div>
          {items && items.length > 0 ? (
            <LiveActivity items={items} />
          ) : (
            <p className="rounded-control border border-dashed border-line px-4 py-10 text-center text-small text-ink-muted">
              Recent neighbourhood activity will show here once listings are available.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}

function LiveActivity({ items }: { items: NeighbourActivityItem[] }) {
  return (
    <>
      <ul className="grid grid-cols-2 gap-3 sm:gap-4" aria-label="Recent activity near you">
        {items.map((item) => (
          <li key={`${item.event}-${item.listingKey}`}>
            <Link
              href={`/property/${encodeURIComponent(item.listingKey)}`}
              className="block overflow-hidden rounded-control border border-line bg-surface transition-shadow hover:shadow-card-hover"
            >
              <div className="relative h-24 overflow-hidden bg-surface-alt">
                {item.imageUrl ? (
                  <SafeImage
                    src={item.imageUrl}
                    alt=""
                    fill
                    sizes="(min-width: 1024px) 25vw, 50vw"
                    className="object-cover"
                  />
                ) : (
                  <div
                    className="absolute inset-0 bg-linear-to-br from-navy/20 to-navy/5"
                    aria-hidden="true"
                  />
                )}
                <Badge tone={EVENT_TONES[item.event]} className="absolute left-2 top-2 px-2 py-0.5">
                  {item.event}
                </Badge>
              </div>
              <div className="p-3">
                <p className="text-small font-semibold text-ink">
                  {formatActivityPrice(item)}
                </p>
                <p className="truncate text-caption text-ink-muted">{item.address}</p>
                <p className="mt-0.5 text-caption text-ink-subtle">
                  {formatActivityWhen(item.occurredAt, item.event)}
                </p>
              </div>
            </Link>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-caption text-ink-subtle">
        Recent activity near areas you&apos;ve been exploring — set an alert below to get started.
      </p>
    </>
  );
}

function formatActivityPrice(item: NeighbourActivityItem): string {
  const price = formatPriceCompact(item.listPrice);
  if (item.event === "Price Drop" && price !== "—") return `${price} ↓`;
  return price;
}

function formatActivityWhen(
  value: string | null | undefined,
  event: NeighbourActivityEvent,
): string {
  if (!value) return "";
  const iso = /^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T12:00:00` : value;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";

  const startOfDay = (d: Date) =>
    new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const today = startOfDay(new Date());
  const target = startOfDay(date);
  const dayDiff = Math.round((target - today) / 86_400_000);

  if (event === "Open House") {
    if (dayDiff === 0) return "Today";
    if (dayDiff === 1) return "Tomorrow";
    const weekday = date.getDay();
    if (dayDiff > 0 && dayDiff <= 7 && (weekday === 0 || weekday === 6)) {
      return "This weekend";
    }
    if (dayDiff > 0 && dayDiff < 7) {
      return date.toLocaleDateString("en-CA", { weekday: "long" });
    }
    return date.toLocaleDateString("en-CA", { month: "short", day: "numeric" });
  }

  if (dayDiff === 0) return "Today";
  if (dayDiff === -1) return "Yesterday";
  if (dayDiff < 0 && dayDiff > -14) return `${Math.abs(dayDiff)} days ago`;
  return date.toLocaleDateString("en-CA", { month: "short", day: "numeric" });
}
