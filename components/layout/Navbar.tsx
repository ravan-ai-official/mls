"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Suspense, useId, useState, type ReactNode } from "react";
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
   * Extra query check for links that share a path (rarely needed now that
   * sale/rent share one Listings entry).
   */
  match?: (params: URLSearchParams) => boolean;
}

const NAV_LINKS: NavLinkItem[] = [
  { label: "Listings", href: "/listings" },
  { label: "Map Search", href: "/map-search" },
  { label: "Preconstruction", href: "/preconstruction" },
  { label: "Assignments", href: "/assignments" },
  { label: "Sell", href: "/sell" },
  { label: "Market Insights", href: "/market-trends" },
  { label: "Communities", href: "/communities" },
  { label: "Blog", href: "/blog" },
];

const LISTINGS_LINK = { label: "Listings", href: "/listings" };

/** True for buy/rent/sale nav items that should collapse into Listings. */
function isListingsBrowseLink(link: { label: string; href: string }) {
  const path = link.href.split("?")[0];
  if (path !== "/listings") return false;
  const label = link.label.trim().toLowerCase();
  return (
    label === "buy" ||
    label === "rent" ||
    label === "for sale" ||
    label === "for rent" ||
    label === "sale" ||
    label === "listings" ||
    label === "homes"
  );
}

const CONTACT_HREF = "/contact";

/** Always visible in the desktop rail — keeps one clean line. */
const PRIMARY_PATHS = new Set([
  "/listings",
  "/map-search",
  "/preconstruction",
  "/assignments",
  "/sell",
]);

/** Paths that belong under the More menu on desktop. */
const MORE_PATHS = new Set([
  "/market-trends",
  "/communities",
  "/blog",
]);

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
  /** Optional trailing item (e.g. desktop More menu). */
  trailing?: ReactNode;
}

function NavLinkList({
  links,
  pathname,
  params,
  listClassName,
  linkClassName,
  onNavigate,
  trailing,
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
      {trailing}
    </ul>
  );
}

const BLOG_LINK = { label: "Blog", href: "/blog" };
const MAP_SEARCH_LINK = { label: "Map Search", href: "/map-search" };

/**
 * Collapse Buy / Rent / For Sale CMS entries into one Listings link so the
 * nav matches the filter-bar model (sale vs rent is chosen on the page).
 */
function withUnifiedListingsLink(links: Array<{ label: string; href: string }>) {
  const ahead: Array<{ label: string; href: string }> = [];
  const behind: Array<{ label: string; href: string }> = [];
  let seenBrowse = false;
  for (const link of links) {
    if (isListingsBrowseLink(link)) {
      seenBrowse = true;
      continue;
    }
    if (seenBrowse) behind.push(link);
    else ahead.push(link);
  }
  if (!seenBrowse && !links.some((link) => link.href.split("?")[0] === "/listings")) {
    return [LISTINGS_LINK, ...links];
  }
  if (!seenBrowse) return links;
  return [...ahead, LISTINGS_LINK, ...behind];
}

function withBlogLink(links: Array<{ label: string; href: string }>) {
  const hasBlog = links.some(
    (link) => link.href.split("?")[0] === "/blog" || link.label.trim().toLowerCase() === "blog",
  );
  return hasBlog ? links : [...links, BLOG_LINK];
}

/** Always expose Map Search even when CMS nav omits it. */
function withMapSearchLink(links: Array<{ label: string; href: string }>) {
  const hasMap = links.some((link) => {
    const path = link.href.split("?")[0];
    const label = link.label.trim().toLowerCase();
    return path === "/map-search" || label === "map search" || label === "map-search";
  });
  if (hasMap) return links;

  let insertAt = 0;
  for (let i = 0; i < links.length; i += 1) {
    if (links[i].href.split("?")[0] === "/listings") insertAt = i + 1;
  }
  return [...links.slice(0, insertAt), MAP_SEARCH_LINK, ...links.slice(insertAt)];
}

/** Drop Contact from the text-link rail when it is shown as its own button. */
function withoutContactLink(links: NavLinkItem[]) {
  return links.filter(
    (link) =>
      link.href.split("?")[0] !== CONTACT_HREF &&
      link.label.trim().toLowerCase() !== "contact",
  );
}

function pathOf(link: NavLinkItem) {
  return link.href.split("?")[0];
}

function splitNavLinks(links: NavLinkItem[]) {
  const primary: NavLinkItem[] = [];
  const more: NavLinkItem[] = [];
  for (const link of links) {
    const path = pathOf(link);
    if (PRIMARY_PATHS.has(path)) primary.push(link);
    else if (MORE_PATHS.has(path)) more.push(link);
    else more.push(link);
  }
  // Keep Sell after the browse links even if CMS order drifts.
  primary.sort((a, b) => {
    const rank = (path: string) =>
      path === "/listings"
        ? 0
        : path === "/map-search"
          ? 1
          : path === "/preconstruction"
            ? 2
            : path === "/sell"
              ? 3
              : 4;
    return rank(pathOf(a)) - rank(pathOf(b));
  });
  return { primary, more };
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
    withMapSearchLink(
      withBlogLink(withUnifiedListingsLink(links?.length ? links : NAV_LINKS)),
    ),
  );
  const { primary, more } = splitNavLinks(navLinks);
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { user, openAuth, signOut } = useAuth();
  const { favorites } = useWatched();
  const menuId = useId();
  const contactActive = pathname.startsWith(CONTACT_HREF);

  // Close the mobile menu when the path changes.
  const [lastPath, setLastPath] = useState(pathname);
  if (pathname !== lastPath) {
    setLastPath(pathname);
    setMobileOpen(false);
  }

  function closeMobile() {
    setMobileOpen(false);
  }

  const linkClass = (active: boolean) =>
    cn(
      "relative inline-flex items-center whitespace-nowrap py-2 text-[13px] font-medium text-ink transition-colors xl:text-small",
      "after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:origin-left after:scale-x-0 after:rounded-full after:bg-gold after:transition-transform after:duration-200 after:ease-out",
      "hover:text-gold hover:after:scale-x-100",
      active && "text-gold after:scale-x-100",
    );

  return (
    <header
      className={cn(
        "sticky top-0 border-b border-line bg-surface/95 backdrop-blur supports-[backdrop-filter]:bg-surface/85",
        // Above map chrome (z-480) so More / account menus aren’t covered by
        // zoom controls; below Modal / SideSheet (z-600).
        mobileOpen ? "z-[530]" : "z-[520]",
      )}
    >
      <div className="container-page flex h-[72px] items-center justify-between gap-4 lg:h-20">
        <Logo className="shrink-0" />

        {/*
          Desktop rail: a short primary set + More dropdown so the bar stays
          one line at lg+ without wrapping or a horizontal scrollbar.
        */}
        <nav aria-label="Primary" className="hidden min-w-0 flex-1 justify-center lg:flex">
          <NavLinks
            links={primary}
            pathname={pathname}
            listClassName="flex h-full items-center gap-5 xl:gap-6"
            linkClassName={linkClass}
            trailing={
              more.length > 0 ? (
                <li className="flex h-full items-center">
                  <MoreNav links={more} pathname={pathname} />
                </li>
              ) : null
            }
          />
        </nav>

        <div className="hidden shrink-0 items-center gap-2 lg:flex xl:gap-3">
          <LinkButton
            href={CONTACT_HREF}
            variant="secondary"
            size="sm"
            className={cn(contactActive && "border-navy text-navy")}
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
            <span className="hidden xl:inline">{ctaLabel}</span>
            <span className="xl:hidden">Evaluate</span>
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
              <span className="hidden xl:inline">Sign In / Register</span>
              <span className="xl:hidden">Sign In</span>
            </Button>
          )}
        </div>

        <button
          type="button"
          className="rounded-control p-2 text-ink lg:hidden"
          aria-expanded={mobileOpen}
          aria-controls={menuId}
          aria-label={mobileOpen ? "Close menu" : "Open menu"}
          onClick={() => setMobileOpen((open) => !open)}
        >
          {mobileOpen ? <CloseGlyph /> : <MenuGlyph />}
        </button>
      </div>

      {mobileOpen && (
        <div id={menuId} className="border-t border-line bg-surface lg:hidden">
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

            <div className="flex flex-col gap-2.5 py-4">
              <LinkButton
                href={CONTACT_HREF}
                variant="secondary"
                size="md"
                block
                onClick={closeMobile}
              >
                Contact
              </LinkButton>
              <LinkButton
                href={ctaHref}
                variant="secondary"
                size="md"
                block
                className="border-gold/40 bg-gold-soft"
                onClick={closeMobile}
              >
                {ctaLabel}
              </LinkButton>
              {user ? (
                <Button
                  variant="primary"
                  size="md"
                  block
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
                  block
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

function MoreNav({ links, pathname }: { links: NavLinkItem[]; pathname: string }) {
  return (
    <Suspense fallback={<MoreNavList links={links} pathname={pathname} params={null} />}>
      <MoreNavWithQuery links={links} pathname={pathname} />
    </Suspense>
  );
}

function MoreNavWithQuery({ links, pathname }: { links: NavLinkItem[]; pathname: string }) {
  const params = useSearchParams();
  return <MoreNavList links={links} pathname={pathname} params={params} />;
}

function MoreNavList({
  links,
  pathname,
  params,
}: {
  links: NavLinkItem[];
  pathname: string;
  params: URLSearchParams | null;
}) {
  const anyActive = links.some((link) => isLinkActive(link, pathname, params));

  return (
    <Menu
      align="left"
      openOnHover
      panelClassName="w-56 py-1"
      trigger={({ open, buttonProps }) => (
        <button
          type="button"
          {...buttonProps}
          className={cn(
            "relative inline-flex items-center gap-1 whitespace-nowrap py-2 text-[13px] font-medium text-ink transition-colors xl:text-small",
            "after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:origin-left after:scale-x-0 after:rounded-full after:bg-gold after:transition-transform after:duration-200 after:ease-out",
            "hover:text-gold hover:after:scale-x-100",
            (anyActive || open) && "text-gold after:scale-x-100",
          )}
        >
          More
          <ChevronGlyph open={open} />
        </button>
      )}
    >
      {(close) => (
        <>
          {links.map((link) => {
            const active = isLinkActive(link, pathname, params);
            return (
              <MenuItem
                key={link.label}
                href={link.href}
                LinkComponent={Link}
                onSelect={close}
                className={cn(
                  "px-4 py-3 transition-colors",
                  active
                    ? "bg-gold-soft/60 font-semibold text-navy"
                    : "hover:bg-surface-alt hover:text-navy",
                )}
              >
                {link.label}
              </MenuItem>
            );
          })}
        </>
      )}
    </Menu>
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

function ChevronGlyph({ open }: { open: boolean }) {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 12 12"
      fill="none"
      aria-hidden="true"
      className={cn("transition-transform", open && "rotate-180")}
    >
      <path
        d="M3 4.5L6 7.5L9 4.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
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
