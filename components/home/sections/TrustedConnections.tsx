"use client";

import { Eyebrow } from "@/components/ui/Badge";
import { getPartners } from "@/lib/api/home";
import { connectionIconFor, type Partner } from "@/lib/api/homeMappers";
import { WhatsappLink } from "@/components/providers/WhatsappProvider";
import { trustedConnections } from "@/lib/home/contentSections";
import { useMlsQuery } from "@/lib/queries/useMlsQuery";
import { headingLines, textOf } from "@/lib/site/read";
import { ConnectionGlyph } from "./contentIcons";

/**
 * "Trusted Connections for Your Journey" — HomeAtlasUI HomePage L1056-1086.
 *
 * Partners are LIVE from `/api/home/partners/` (admin-maintained); a partner
 * with a website links to it. With no partners published (or on failure) the
 * reference's six categories render. "Connect Now" (a dead button in the
 * reference) opens WhatsApp with the request prefilled and the team makes the
 * introduction.
 */
interface ConnectionView {
  key: string;
  category: string;
  title: string;
  desc: string;
  icon: ReturnType<typeof connectionIconFor>;
  websiteUrl: string | null;
  message: string;
}

function fromPartner(p: Partner): ConnectionView {
  return {
    key: p.id,
    category: p.category,
    title: p.name,
    desc: p.description,
    icon: connectionIconFor(p.category),
    websiteUrl: p.websiteUrl,
    message: `Hi, I'd like to be connected with ${p.name}.`,
  };
}

export function TrustedConnections({ content }: { content?: Record<string, unknown> }) {
  const { data: partners } = useMlsQuery(
    ["home", "partners"],
    () => getPartners(),
    null,
  );
  const items: ConnectionView[] =
    partners && partners.length > 0
      ? partners.map(fromPartner)
      : trustedConnections.map((c) => ({
          ...c,
          key: c.title,
          websiteUrl: null,
          message: `Hi, I'd like to be connected with one of your trusted ${c.title.toLowerCase()}.`,
        }));

  return (
    <section className="bg-surface py-10 sm:py-14 lg:py-16">
      <div className="container-page">
        <div className="mb-10 text-center sm:mb-12">
          <Eyebrow>{textOf(content, "eyebrow", "Your real estate network")}</Eyebrow>
          <h2 className="mt-3 text-display text-ink">
            {headingLines(textOf(content, "title", "Trusted Connections for\nYour Journey")).map((line, index) => (
              <span key={line}>
                {index > 0 && <br />}
                {line}
              </span>
            ))}
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-body text-ink-muted">
            {textOf(content, "description", "We connect you with top-tier professionals to ensure every aspect of your real estate experience is seamless, secure, and exceptional.")}
          </p>
        </div>
        <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => (
            <li
              key={item.key}
              className="flex flex-col rounded-control border border-line p-6 transition-all hover:border-gold/30 hover:shadow-card-hover"
            >
              <ConnectionGlyph icon={item.icon} className="text-gold" />
              <p className="mt-4 text-eyebrow uppercase text-ink-subtle">
                {item.category}
              </p>
              <h3 className="mt-1 text-h3 text-ink">{item.title}</h3>
              <p className="mt-2 text-small text-ink-muted">{item.desc}</p>
              {item.websiteUrl && (
                <a
                  href={item.websiteUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-3 self-start text-caption font-medium text-ink-muted underline-offset-2 hover:text-navy hover:underline"
                >
                  Visit website
                  <span className="sr-only">
                    {" "}
                    of {item.title} (opens in a new tab)
                  </span>
                </a>
              )}
              <WhatsappLink
                message={item.message}
                className="mt-4 self-start text-small font-medium text-navy transition-colors hover:text-gold"
              >
                Connect Now →
                <span className="sr-only">
                  {" "}
                  with {item.title} (opens WhatsApp)
                </span>
              </WhatsappLink>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
