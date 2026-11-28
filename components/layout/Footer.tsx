import Link from "next/link";
import { Logo } from "@/components/layout/Logo";
import { LinkButton } from "@/components/ui/Button";
import { Eyebrow } from "@/components/ui/Badge";
import { resolveSocials } from "@/lib/content/company";
import { curatedPath, getCuratedPage } from "@/lib/seo/curatedPages";
import type { ChromeDocument } from "@/lib/site/types";

/** A few curated searches (scope #24) for the footer; the full set is on /site-map. */
const POPULAR_SLUGS = ["power-of-sale", "detached-under-1m", "condos-under-500k", "luxury-homes", "open-houses", "condos-for-rent"];

const COLUMNS: Array<{ heading: string; links: Array<{ label: string; href: string }> }> = [
  {
    heading: "Explore",
    links: [
      { label: "Buy a home", href: "/listings?status=Active" },
      { label: "Rentals", href: "/listings?tx=rent" },
      { label: "Preconstruction", href: "/preconstruction" },
      { label: "Assignments", href: "/assignments" },
      { label: "Map search", href: "/map-search" },
      { label: "Recently sold", href: "/recently-sold" },
      { label: "Communities", href: "/communities" },
    ],
  },
  {
    heading: "Sell",
    links: [
      { label: "Home evaluation", href: "/home-evaluation" },
      { label: "Sell with us", href: "/sell" },
      { label: "Market trends", href: "/market-trends" },
    ],
  },
  {
    heading: "Popular searches",
    links: POPULAR_SLUGS.flatMap((slug) => {
      const page = getCuratedPage(slug);
      return page ? [{ label: page.label, href: curatedPath(page) }] : [];
    }),
  },
  {
    heading: "Company",
    links: [
      { label: "About", href: "/about" },
      { label: "Contact", href: "/contact" },
      { label: "Privacy", href: "/privacy" },
      { label: "Terms", href: "/terms" },
      { label: "Saved homes", href: "/watched" },
      { label: "Compare homes", href: "/compare" },
      { label: "Blog", href: "/blog" },
      { label: "Sitemap", href: "/site-map" },
    ],
  },
];

const COMPANY_PAGES = [
  { label: "About", href: "/about" },
  { label: "Contact", href: "/contact" },
  { label: "Privacy", href: "/privacy" },
  { label: "Terms", href: "/terms" },
];

const SOCIAL_PATHS: Record<string, string> = {
  facebook:
    "M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z",
  instagram:
    "M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z",
  youtube:
    "M23.498 6.186a3.016 3.016 0 00-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 00.502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 002.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 002.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z",
  x: "M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z",
  linkedin:
    "M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z",
};

const SOCIAL_LABELS: Record<string, string> = {
  facebook: "Facebook",
  instagram: "Instagram",
  youtube: "YouTube",
  x: "X",
  linkedin: "LinkedIn",
};

function withCompanyPages(
  columns: Array<{ heading: string; links: Array<{ label: string; href: string }> }>,
) {
  const known = new Set(columns.flatMap((column) => column.links.map((link) => link.href.split("?")[0])));
  const missing = COMPANY_PAGES.filter((link) => !known.has(link.href));
  if (missing.length === 0) return columns;
  const next = columns.map((column) => ({ ...column, links: [...column.links] }));
  const company = next.find((column) => column.heading.toLowerCase() === "company");
  if (company) {
    company.links = [...missing, ...company.links];
    return next;
  }
  return [...next, { heading: "Company", links: missing }];
}

export function Footer({ footer }: { footer?: ChromeDocument["footer"] }) {
  const columns = withCompanyPages(footer?.columns?.length ? footer.columns : COLUMNS);
  const socials = resolveSocials(footer?.socials).flatMap((item) => {
    const path = SOCIAL_PATHS[item.network];
    if (!path) return [];
    return [{ label: SOCIAL_LABELS[item.network] || item.network, href: item.href, path }];
  });
  return (
    <footer className="bg-ink text-white">
      <div className="border-b border-white/10 py-10 sm:py-14 lg:py-16">
        <div className="container-page flex flex-col items-start justify-between gap-5 sm:flex-row sm:items-center sm:gap-6">
          <div className="min-w-0 flex-1">
            <Eyebrow>{footer?.bannerEyebrow || "Still looking?"}</Eyebrow>
            <h2 className="mt-2 text-h1 text-white">
              {footer?.bannerHeading || "Let our team find your perfect home."}
            </h2>
          </div>
          <LinkButton
            href={footer?.bannerHref || "/listings"}
            variant="accent"
            size="lg"
            className="w-full shrink-0 sm:w-auto"
          >
            {footer?.bannerLabel || "Browse all listings"} →
          </LinkButton>
        </div>
      </div>

      <div className="container-page py-10 sm:py-12 lg:py-14">
        {/*
          Mobile: brand full-width, then link columns in a 2×2 so the footer
          doesn’t become a long single stack. Desktop: brand + four columns.
        */}
        <div className="grid grid-cols-2 gap-x-6 gap-y-8 sm:gap-x-8 sm:gap-y-10 lg:grid-cols-[minmax(0,2fr)_repeat(4,minmax(0,1fr))] lg:gap-10">
          <div className="col-span-2 lg:col-span-1">
            <Logo tone="dark" />
            <p className="mt-3 max-w-[280px] text-small leading-relaxed text-white/50 sm:mt-4">
              {footer?.blurb ||
                "HomeAtlas is a real estate intelligence platform providing GTA home valuations and market data."}
            </p>
            <ul className="mt-5 flex flex-wrap gap-2.5 sm:mt-6">
              {socials.map((social) => (
                <li key={social.label}>
                  <a
                    href={social.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`HomeAtlas on ${social.label}`}
                    className="flex h-9 w-9 items-center justify-center rounded-full border border-white/20 text-white/50 transition-colors hover:border-gold hover:text-gold"
                  >
                    <svg
                      width="13"
                      height="13"
                      viewBox="0 0 24 24"
                      fill="currentColor"
                      aria-hidden="true"
                    >
                      <path d={social.path} />
                    </svg>
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {columns.map((column) => (
            <nav key={column.heading} aria-label={column.heading} className="min-w-0">
              <h3 className="text-small font-semibold text-white">{column.heading}</h3>
              <ul className="mt-3 space-y-2 sm:mt-4 sm:space-y-2.5">
                {column.links.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      className="text-small text-white/50 transition-colors hover:text-gold"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>
      </div>

      <div className="border-t border-white/10 py-5 sm:py-6">
        <div className="container-page flex flex-col gap-3 text-caption text-white/40 sm:flex-row sm:items-start sm:justify-between">
          <p className="shrink-0">
            © {new Date().getFullYear()} HomeAtlas. All rights reserved.{" "}
            <Link href="/cookies" className="hover:text-gold">
              Cookies
            </Link>
          </p>
          <p className="max-w-2xl sm:text-right">
            MLS®, REALTOR® and associated logos are trademarks of The Canadian Real
            Estate Association. Listing data is provided for consumers&rsquo; personal,
            non-commercial use.
          </p>
        </div>
      </div>
    </footer>
  );
}
