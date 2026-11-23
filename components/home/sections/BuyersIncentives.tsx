"use client";

import { Eyebrow } from "@/components/ui/Badge";
import { Section } from "@/components/ui/Section";
import { getIncentives } from "@/lib/api/home";
import { formatDay, type Incentive } from "@/lib/api/homeMappers";
import { WhatsappLink } from "@/components/providers/WhatsappProvider";
import { useMlsQuery } from "@/lib/queries/useMlsQuery";
import { textOf } from "@/lib/site/read";
import { buyerIncentives } from "@/lib/home/staticSections";
import { ArrowGlyph, IncentiveGlyph, WhatsAppGlyph } from "./sectionIcons";

/**
 * "Buyer's Incentives" — HomeAtlasUI HomePage L708-752.
 *
 * Programs are LIVE from `/api/home/incentives/` (admin-maintained), each
 * with its "Verified <date>" and a link to the official source when set. If
 * none are published (or the call fails) the reference's list renders. Either
 * way a caption tells buyers to confirm eligibility. The reference's "Learn if you qualify" was a button
 * with no handler; here it opens WhatsApp prefilled with that program. The
 * CTA uses the brokerage number (lib/constants/contact.ts) rather than the
 * reference's placeholder, on a navy button with the green glyph — white text
 * on WhatsApp green is too low-contrast.
 */

const CTA_MESSAGE =
  "Hi, I'd like to know which buyer incentives I qualify for.";

function sampleIncentives(): Incentive[] {
  return buyerIncentives.map((item) => ({
    id: item.title,
    title: item.title,
    label: item.label,
    icon: item.icon,
    amountText: item.amount,
    description: item.desc,
    sourceUrl: null,
    reviewedAt: null,
  }));
}

export function BuyersIncentives({ content }: { content?: Record<string, unknown> }) {
  const samples = sampleIncentives();
  const { data: items = samples } = useMlsQuery<Incentive[]>(
    ["home", "incentives"],
    async () => {
      const live = await getIncentives().catch(() => null);
      return live && live.length > 0 ? live : samples;
    },
    samples,
  );

  return (
    <Section>
      <div className="mb-8 text-center sm:mb-12">
        <Eyebrow>{textOf(content, "eyebrow", "Maximize your savings")}</Eyebrow>
        <h2 className="mt-2 text-h1 text-ink">{textOf(content, "title", "Buyer's Incentives")}</h2>
        <p className="mx-auto mt-3 max-w-xl text-body text-ink-muted">
          {textOf(content, "description", "Explore government programs and financial incentives available to GTA homebuyers. Choose from multiple options that apply to your situation.")}
        </p>
        <p className="mt-2 text-caption text-ink-subtle">
          Program amounts change — confirm eligibility with an agent.
        </p>
      </div>

      <ul className="mb-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((item) => (
          <li
            key={item.id}
            className="flex flex-col rounded-surface border border-line p-6 transition-shadow hover:shadow-card-hover"
          >
            <div className="mb-4 flex items-start justify-between">
              <div className="flex h-10 w-10 items-center justify-center rounded-control bg-gold-soft">
                <IncentiveGlyph
                  icon={item.icon}
                  className="h-5 w-5 text-gold-deep"
                />
              </div>
              <span className="rounded-full border border-gold/30 px-2.5 py-1 text-caption font-bold text-gold-deep">
                {item.amountText}
              </span>
            </div>
            <p className="mb-1 text-eyebrow uppercase text-ink-subtle">
              {item.label}
            </p>
            <h3 className="mb-2 text-h3 text-ink">{item.title}</h3>
            <p className="mb-4 flex-1 text-small text-ink-muted">
              {item.description}
            </p>
            {(item.reviewedAt || item.sourceUrl) && (
              <p className="mb-3 flex flex-wrap items-center gap-x-3 text-caption text-ink-subtle">
                {item.reviewedAt && (
                  <span>Verified {formatDay(item.reviewedAt)}</span>
                )}
                {item.sourceUrl && (
                  <a
                    href={item.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium text-navy underline-offset-2 hover:underline"
                  >
                    Source
                    <span className="sr-only">
                      {" "}
                      for {item.title} (opens in a new tab)
                    </span>
                  </a>
                )}
              </p>
            )}
            <WhatsappLink
              message={`Hi, I'd like to know if I qualify for the ${item.title}.`}
              className="inline-flex items-center gap-1 self-start text-small font-medium text-navy transition-colors hover:text-gold-deep"
            >
              Learn if you qualify
              <ArrowGlyph />
              <span className="sr-only">(opens WhatsApp)</span>
            </WhatsappLink>
          </li>
        ))}
      </ul>

      <div className="flex justify-center">
        <WhatsappLink
          message={CTA_MESSAGE}
          className="inline-flex h-12 items-center gap-2.5 rounded-control bg-navy px-8 text-body font-semibold text-white transition-colors hover:bg-navy-deep"
        >
          <WhatsAppGlyph />
          Ask on WhatsApp
          <span className="sr-only">(opens WhatsApp)</span>
        </WhatsappLink>
      </div>
    </Section>
  );
}
