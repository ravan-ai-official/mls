"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Suspense, useId, useState } from "react";
import { cn } from "@/lib/utils/cn";
import { Logo } from "@/components/layout/Logo";
import { Button, LinkButton } from "@/components/ui/Button";
import { Menu, MenuItem } from "@/components/ui/Menu";
import { WatchedMenu } from "@/components/layout/WatchedMenu";
import { useAuth } from "@/components/providers/AuthProvider";
import { useWatched } from "@/components/providers/WatchedProvider";

interface NavLinkItem {
  label: string;
  href: string;
  /**
   * Extra query check for links that share a path. Buy and Rent both live on
   * /listings, so the path alone would light up both.
   */
  match?: (params: URLSearchParams) => boolean;
}

/** Mirrors parseListingParams: `tx=rent`, or the legacy `type=Rental`. */
const isRental = (params: URLSearchParams) =>
  params.get("tx") === "rent" || params.get("type") === "Rental";

const NAV_LINKS: NavLinkItem[] = [
  { label: "Buy", href: "/listings?status=Active", match: (params) => !isRental(params) },
  { label: "Rent", href: "/listings?tx=rent", match: isRental },
  { label: "Preconstruction", href: "/preconstruction" },
  { label: "Assignments", href: "/assignments" },
  { label: "Sell", href: "/sell" },
  { label: "Market Insights", href: "/market-trends" },
  { label: "Communities", href: "/communities" },
  { label: "Blog", href: "/blog" },
];

const CONTACT_HREF = "/contact";

function isLinkActive(
  link: NavLinkItem,
  pathname: string,
  params: URLSearchParams | null,
): boolean {
  const base = link.href.split("?")[0];
  const onPath = base === "/" ? pathname === "/" : pathname.startsWith(base);
  if (!onPath || !link.match) return onPath;
  // Before the query is known (prerender fallback), a query-dependent link
  // stays unlit rather than guessing.
  return params ? link.match(params) : false;
}

/**
 * The link list, shared by the desktop bar and the mobile menu. Reading the
 * query needs `useSearchParams`, which must sit under Suspense in a layout or
 * the production build fails. The fallback renders the same links with
 * query-dependent ones unlit.
 */
function NavLinks(props: NavLinksProps) {
  return (
    <Suspense fallback={<NavLinkList {...props} params={null} />}>
      <NavLinksWithQuery {...props} />
    </Suspense>
  );
}

function NavLinksWithQuery(props: NavLinksProps) {
  const params = useSearchParams();
  return <NavLinkList {...props} params={params} />;
}

interface NavLinksProps {
  links: NavLinkItem[];
  pathname: string;
  listClassName: string;
  linkClassName: (active: boolean) => string;
  /** Fired when a link is activated — used to dismiss the mobile drawer. */
  onNavigate?: () => void;
}

function NavLinkList({
  links,
  pathname,
  params,
  listClassName,
  linkClassName,
  onNavigate,
}: NavLinksProps & { params: URLSearchParams | null }) {
  return (
    <ul className={listClassName}>
      {links.map((link) => {
        const active = isLinkActive(link, pathname, params);
        return (
          <li key={link.label}>
            <Link
              href={link.href}
              aria-current={active ? "page" : undefined}
              className={linkClassName(active)}
              onClick={onNavigate}
            >
              {link.label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function decorate(link: { label: string; href: string }): NavLinkItem {
  if (link.href.includes("tx=rent") || link.href.includes("type=Rental")) return { ...link, match: isRental };
  if (link.href.startsWith("/listings")) return { ...link, match: (params) => !isRental(params) };
  return link;
}

const BLOG_LINK = { label: "Blog", href: "/blog" };

function withBlogLink(links: Array<{ label: string; href: string }>) {
  const hasBlog = links.some(
    (link) => link.href.split("?")[0] === "/blog" || link.label.trim().toLowerCase() === "blog",
  );
  return hasBlog ? links : [...links, BLOG_LINK];
}

/** Drop Contact from the text-link rail when it is shown as its own button. */
function withoutContactLink(links: NavLinkItem[]) {
  return links.filter(
    (link) =>
      link.href.split("?")[0] !== CONTACT_HREF &&
      link.label.trim().toLowerCase() !== "contact",
  );
}

export function Navbar({
  links,
  ctaLabel = "Home Evaluation",
  ctaHref = "/home-evaluation",
}: {
  links?: Array<{ label: string; href: string }>;
  ctaLabel?: string;
  ctaHref?: string;
}) {
  const navLinks = withoutContactLink(
    withBlogLink(links?.length ? links : NAV_LINKS).map(decorate),
  );
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { user, openAuth, signOut } = useAuth();
  const { favorites } = useWatched();
  const menuId = useId();
  const contactActive = pathname.startsWith(CONTACT_HREF);

  // Close the mobile menu when the path changes. Buy ↔ Rent stay on /listings,
  // so those links also call closeMobile() on click (pathname alone wouldn't).
  const [lastPath, setLastPath] = useState(pathname);
  if (pathname !== lastPath) {
    setLastPath(pathname);
    setMobileOpen(false);
  }

  function closeMobile() {
    setMobileOpen(false);
  }

  return (
    <header className="sticky top-0 z-50 border-b border-line bg-surface/95 backdrop-blur supports-[backdrop-filter]:bg-surface/85">
      <div className="container-page flex h-[72px] items-center justify-between gap-3 xl:h-20 xl:gap-4">
        <Logo className="shrink-0" />

        {/*
          Full primary rail only from xl up. Between lg and xl the link count
          used to force a hidden horizontal scrollbar; the hamburger covers
          that range instead so every label stays reachable without clipping.
        */}
        <nav aria-label="Primary" className="hidden min-w-0 flex-1 justify-center xl:flex">
          <NavLinks
            links={navLinks}
            pathname={pathname}
            listClassName="flex max-w-full flex-wrap items-center justify-center gap-x-3 gap-y-1 px-1 2xl:gap-x-5"
            linkClassName={(active) =>
              cn(
                "whitespace-nowrap text-[13px] font-medium transition-colors hover:text-gold 2xl:text-small",
                active ? "text-gold" : "text-ink",
              )
            }
          />
        </nav>

        <div className="hidden shrink-0 items-center gap-2 xl:flex 2xl:gap-3">
          <LinkButton
            href={CONTACT_HREF}
            variant="ghost"
            size="sm"
            className={cn(
              "text-ink hover:bg-surface-alt hover:text-navy",
              contactActive && "text-navy",
            )}
          >
            Contact
          </LinkButton>
          <LinkButton
            href={ctaHref}
            variant="secondary"
            size="sm"
            className="border-gold/40 bg-gold-soft hover:bg-gold-soft/80"
          >
            <StarGlyph />
            {ctaLabel}
          </LinkButton>

          {/* Keyed by pathname: remounting on navigation closes an open panel,
              the same reset the mobile menu gets from the lastPath check. */}
          <WatchedMenu key={`watched:${pathname}`} />

          {user ? (
            <UserMenu
              key={`user:${pathname}`}
              name={user.name}
              email={user.email}
              canUseStudio={user.canUseStudio}
              onSignOut={signOut}
            />
          ) : (
            <Button variant="primary" size="sm" onClick={() => openAuth("login")}>
              Sign In / Register
            </Button>
          )}
        </div>

        <button
          type="button"
          className="rounded-control p-2 text-ink xl:hidden"
          aria-expanded={mobileOpen}
          aria-controls={menuId}
          aria-label={mobileOpen ? "Close menu" : "Open menu"}
          onClick={() => setMobileOpen((open) => !open)}
        >
          {mobileOpen ? <CloseGlyph /> : <MenuGlyph />}
        </button>
      </div>

      {mobileOpen && (
        <div id={menuId} className="border-t border-line bg-surface xl:hidden">
          <nav aria-label="Mobile" className="container-page py-2">
            <NavLinks
              links={navLinks}
              pathname={pathname}
              onNavigate={closeMobile}
              listClassName="flex flex-col"
              linkClassName={(active) =>
                cn(
                  "block border-b border-line-soft py-3.5 text-small font-medium transition-colors",
                  active ? "text-gold" : "text-ink hover:text-gold",
                )
              }
            />
            <Link
              href={CONTACT_HREF}
              onClick={closeMobile}
              aria-current={contactActive ? "page" : undefined}
              className={cn(
                "block border-b border-line-soft py-3.5 text-small font-medium transition-colors",
                contactActive ? "text-gold" : "text-ink hover:text-gold",
              )}
            >
              Contact
            </Link>
            <Link
              href="/watched"
              onClick={closeMobile}
              className="block border-b border-line-soft py-3.5 text-small font-medium text-ink hover:text-gold"
            >
              Watched{favorites.length > 0 ? ` (${favorites.length})` : ""}
            </Link>
            {user && (
              <Link
                href="/account"
                onClick={closeMobile}
                className="block border-b border-line-soft py-3.5 text-small font-medium text-ink hover:text-gold"
              >
                Account settings
              </Link>
            )}

            <div className="flex flex-col gap-3 py-4 sm:flex-row">
              <LinkButton
                href={CONTACT_HREF}
                variant="secondary"
                size="md"
                className="flex-1"
                onClick={closeMobile}
              >
                Contact
              </LinkButton>
              <LinkButton
                href={ctaHref}
                variant="secondary"
                size="md"
                className="flex-1 border-gold/40 bg-gold-soft"
                onClick={closeMobile}
              >
                {ctaLabel}
              </LinkButton>
              {user ? (
                <Button
                  variant="primary"
                  size="md"
                  className="flex-1"
                  onClick={() => {
                    closeMobile();
                    signOut();
                  }}
                >
                  Sign out
                </Button>
              ) : (
                <Button
                  variant="primary"
                  size="md"
                  className="flex-1"
                  onClick={() => {
                    closeMobile();
                    openAuth("login");
                  }}
                >
                  Sign In
                </Button>
              )}
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}

/** Account dropdown. Dismissal, Escape and focus return come from <Menu>. */
function avatarInitials(name: string, email: string): string {
  const fromName = name
    .split(/\s+/)
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
  if (fromName) return fromName;
  const local = (email.split("@")[0] ?? "").replace(/[^a-zA-Z0-9]/g, "");
  return (local.slice(0, 2) || "?").toUpperCase();
}

function UserMenu({
  name,
  canUseStudio,
  email,
  onSignOut,
}: {
  name: string;
  canUseStudio: boolean;
  email: string;
  onSignOut: () => void;
}) {
  const label = name.trim() || email;
  const initials = avatarInitials(name, email);

  return (
    <Menu
      trigger={({ buttonProps }) => (
        <button
          type="button"
          {...buttonProps}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-navy text-caption font-semibold text-white transition-colors hover:bg-navy-deep"
        >
          <span aria-hidden="true">{initials}</span>
          <span className="sr-only">Account menu for {label}</span>
        </button>
      )}
    >
      {(close) => (
        <>
          <div className="border-b border-line px-4 py-3">
            <p className="truncate text-small font-medium text-ink">{label}</p>
            <p className="truncate text-caption text-ink-muted">{email}</p>
          </div>
          <MenuItem href="/watched" LinkComponent={Link} onSelect={close}>
            Saved homes
          </MenuItem>
          <MenuItem href="/account" LinkComponent={Link} onSelect={close}>
            Account settings
          </MenuItem>
          {/* Only rendered for Studio users. This is convenience, not security —
              the route and its API guard themselves server-side. */}
          {canUseStudio && (
            <MenuItem
              href="/studio"
              LinkComponent={Link}
              onSelect={close}
              className="border-t border-line font-medium text-navy"
            >
              Admin console
            </MenuItem>
          )}
          <MenuItem
            onSelect={() => {
              close();
              onSignOut();
            }}
          >
            Sign out
          </MenuItem>
        </>
      )}
    </Menu>
  );
}

function StarGlyph() {
  return (
    <svg width="14" height="14" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path
        d="M10 1L12.5 7H19L13.5 11L15.5 17.5L10 14L4.5 17.5L6.5 11L1 7H7.5L10 1Z"
        stroke="var(--color-gold)"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function MenuGlyph() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M3 6h18M3 12h18M3 18h18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function CloseGlyph() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M18 6 6 18M6 6l12 12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}
