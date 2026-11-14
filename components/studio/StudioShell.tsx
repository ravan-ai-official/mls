"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useEffectEvent, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import {
  Activity,
  BadgePercent,
  Building2,
  ChevronDown,
  ClipboardCheck,
  ExternalLink,
  Handshake,
  Home,
  Images,
  KeyRound,
  LayoutTemplate,
  Newspaper,
  PanelBottom,
  PanelLeft,
  PanelTop,
  PenLine,
  Plus,
  Search,
  Share2,
  Star,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";

type Icon = LucideIcon;

const GROUPS: Array<{
  id: string;
  label: string;
  staff: boolean;
  links: Array<{ href: string; label: string; icon: Icon; staff?: boolean }>;
}> = [
  {
    id: "editorial",
    label: "Editorial",
    staff: false,
    links: [
      { href: "/studio", label: "Blog posts", icon: PenLine, staff: false },
      { href: "/studio/news", label: "News", icon: Newspaper, staff: true },
      { href: "/studio/incentives", label: "Buyer incentives", icon: BadgePercent, staff: true },
      { href: "/studio/partners", label: "Partners", icon: Handshake, staff: true },
      { href: "/studio/communities", label: "Community photos", icon: Images, staff: true },
    ],
  },
  {
    id: "listings",
    label: "Listings",
    staff: true,
    links: [
      { href: "/studio/listings", label: "Brokerage listings", icon: Home },
      { href: "/studio/precon", label: "Pre-construction", icon: Building2 },
      { href: "/studio/featured", label: "Featured homes", icon: Star },
      { href: "/studio/keywords", label: "Keyword searches", icon: Search },
      { href: "/studio/assignments", label: "Review queue", icon: ClipboardCheck },
    ],
  },
  {
    id: "site",
    label: "Public site",
    staff: true,
    links: [
      { href: "/studio/site", label: "Homepage", icon: LayoutTemplate },
      { href: "/studio/site/header", label: "Header and menu", icon: PanelTop },
      { href: "/studio/site/footer", label: "Footer", icon: PanelBottom },
      { href: "/studio/site/contact", label: "Socials and contact", icon: Share2 },
      { href: "/studio/site/seo", label: "Search and sharing", icon: Search },
    ],
  },
  {
    id: "workspace",
    label: "Workspace",
    staff: true,
    links: [
      { href: "/studio/activity", label: "Activity", icon: Activity },
      { href: "/studio/team", label: "Team", icon: Users },
      { href: "/studio/connections", label: "Connections", icon: KeyRound },
    ],
  },
];

const CREATE_LINKS: Array<{ href: string; label: string; staff?: boolean }> = [
  { href: "/studio/new", label: "New blog post" },
  { href: "/studio/incentives/new", label: "New incentive", staff: true },
  { href: "/studio/partners/new", label: "New partner", staff: true },
  { href: "/studio/listings/new", label: "New listing", staff: true },
  { href: "/studio/precon/new", label: "New pre-con project", staff: true },
  { href: "/studio/keywords/new", label: "New keyword search", staff: true },
  { href: "/studio/team/new", label: "Invite teammate", staff: true },
];

const RESERVED = new Set([
  "site",
  "connections",
  "listings",
  "precon",
  "featured",
  "keywords",
  "incentives",
  "partners",
  "communities",
  "news",
  "assignments",
  "activity",
  "team",
]);

function readSidebarCollapsed() {
  if (typeof window === "undefined") return true;
  return window.localStorage.getItem("studio-sidebar") !== "open";
}

function subscribeNarrow(onStoreChange: () => void) {
  const query = window.matchMedia("(min-width: 1024px)");
  query.addEventListener("change", onStoreChange);
  return () => query.removeEventListener("change", onStoreChange);
}

function getNarrowSnapshot() {
  return !window.matchMedia("(min-width: 1024px)").matches;
}

function isPostPath(path: string) {
  if (path === "/studio") return true;
  const first = path.split("/")[2];
  return !!first && !RESERVED.has(first);
}

function matches(path: string, href: string) {
  return href === "/studio" ? isPostPath(path) : path === href || path.startsWith(`${href}/`);
}

function Mark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 28 28" className={className} aria-hidden="true">
      <rect width="28" height="28" rx="7" fill="currentColor" />
      <path d="M7 20V12L14 7L21 12V20" stroke="#1b2e4b" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <path d="M11 20V16H17V20" stroke="#1b2e4b" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <circle cx="14" cy="11.5" r="1.5" fill="#1b2e4b" />
    </svg>
  );
}

export function StudioShell({
  isStaff,
  email,
  children,
}: {
  isStaff: boolean;
  email: string;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  // Default to icon rail; "open" in localStorage expands labeled sidebar.
  const [rail, setRail] = useState(readSidebarCollapsed);
  const narrow = useSyncExternalStore(subscribeNarrow, getNarrowSnapshot, () => false);
  const [navQuery, setNavQuery] = useState("");
  const [navOpen, setNavOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [pathSeen, setPathSeen] = useState(pathname);
  const searchRef = useRef<HTMLInputElement>(null);
  const createRef = useRef<HTMLDivElement>(null);

  // Close overlays when the route changes (derive during render).
  if (pathname !== pathSeen) {
    setPathSeen(pathname);
    setOpen(false);
    setNavOpen(false);
    setCreateOpen(false);
    setNavQuery("");
  }

  // Lock the document: only the main pane scrolls, not the browser window.
  useEffect(() => {
    const html = document.documentElement;
    const { body } = document;
    const prevHtml = html.style.overflow;
    const prevBody = body.style.overflow;
    html.style.overflow = "hidden";
    body.style.overflow = "hidden";
    return () => {
      html.style.overflow = prevHtml;
      body.style.overflow = prevBody;
    };
  }, []);

  const onShortcut = useEffectEvent((event: KeyboardEvent) => {
    if (event.key === "Escape") {
      setOpen(false);
      setNavOpen(false);
      setCreateOpen(false);
      return;
    }
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
      event.preventDefault();
      setNavOpen(true);
      searchRef.current?.focus();
    }
  });

  useEffect(() => {
    window.addEventListener("keydown", onShortcut);
    return () => window.removeEventListener("keydown", onShortcut);
  }, []);

  useEffect(() => {
    if (!createOpen) return;
    function onPointer(event: MouseEvent) {
      if (createRef.current && !createRef.current.contains(event.target as Node)) {
        setCreateOpen(false);
      }
    }
    window.addEventListener("mousedown", onPointer);
    return () => window.removeEventListener("mousedown", onPointer);
  }, [createOpen]);

  function toggleNav() {
    if (window.matchMedia("(min-width: 1024px)").matches) {
      setRail((current) => {
        const next = !current;
        window.localStorage.setItem("studio-sidebar", next ? "collapsed" : "open");
        return next;
      });
      return;
    }
    setOpen((current) => !current);
  }

  const groups = GROUPS.filter((group) => !group.staff || isStaff)
    .map((group) => ({
      ...group,
      links: group.links.filter((link) => isStaff || !link.staff),
    }))
    .filter((group) => group.links.length > 0);

  const links = groups.flatMap((group) => group.links.map((link) => ({ ...link, group: group.label })));
  const current = links
    .filter((link) => matches(pathname, link.href))
    .sort((a, b) => b.href.length - a.href.length)[0];
  const initial = (email.trim()[0] || "A").toUpperCase();

  const createLinks = CREATE_LINKS.filter((link) => isStaff || !link.staff);

  const term = navQuery.trim().toLowerCase();
  const navHits = !term
    ? links.slice(0, 8)
    : links.filter(
        (link) =>
          link.label.toLowerCase().includes(term) ||
          link.group.toLowerCase().includes(term) ||
          link.href.toLowerCase().includes(term),
      );

  function goTo(href: string) {
    setNavOpen(false);
    setNavQuery("");
    router.push(href);
  }

  return (
    <div className="studio-console fixed inset-0 z-10 flex overflow-hidden text-ink">
      {open && (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-navy-deep/50 lg:hidden"
          aria-label="Close the menu"
          onClick={() => setOpen(false)}
        />
      )}
      <aside
        inert={narrow && !open ? true : undefined}
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-[16.5rem] flex-col bg-navy-deep text-white transition-[width,transform] duration-200",
          open ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
          rail ? "lg:w-[4.5rem]" : "lg:w-[16.5rem]",
        )}
      >
        <div className={cn("flex h-14 items-center gap-2.5 px-3", rail && "lg:justify-center lg:px-0")}>
          <Link href="/studio" className="flex min-w-0 items-center gap-2.5" aria-label="Admin home">
            <Mark className="h-8 w-8 shrink-0 text-gold" />
            <span className={cn("min-w-0", rail && "lg:sr-only")}>
              <span className="block text-[0.9rem] font-semibold leading-none tracking-tight">HomeAtlas</span>
              <span className="mt-1 block text-[0.6875rem] text-white/55">Admin</span>
            </span>
          </Link>
          <button
            type="button"
            className="ml-auto grid h-8 w-8 place-items-center rounded-control text-white/80 hover:bg-white/10 hover:text-white lg:hidden"
            aria-label="Close menu"
            onClick={() => setOpen(false)}
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <nav aria-label="Admin console" className="studio-nav min-h-0 flex-1 overflow-y-auto px-2 pb-3">
          {groups.map((group) => (
            <div key={group.id} className="pt-2.5">
              <p className={cn("px-2.5 pb-1 text-[0.65rem] font-medium uppercase tracking-wide text-white/40", rail && "lg:sr-only")}>
                {group.label}
              </p>
              {rail ? <div className="mx-2.5 mb-1 hidden h-px bg-white/10 lg:block" aria-hidden="true" /> : null}
              <ul className="space-y-0.5">
                {group.links.map((link) => {
                  const active = current?.href === link.href;
                  const Icon = link.icon;
                  return (
                    <li key={link.href}>
                      <Link
                        href={link.href}
                        aria-current={active ? "page" : undefined}
                        title={link.label}
                        className={cn(
                          "flex items-center gap-2.5 rounded-control px-2.5 py-2 text-small leading-snug text-white/70 transition-colors hover:bg-white/8 hover:text-white",
                          active && "bg-white/12 font-medium text-white shadow-[inset_3px_0_0_0_var(--color-gold)]",
                          rail && "lg:justify-center lg:px-0 lg:py-2.5",
                        )}
                      >
                        <Icon className="h-4 w-4 shrink-0" aria-hidden />
                        <span className={cn(rail && "lg:sr-only")}>{link.label}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>

        {/* User chip stays in the expanded sidebar; rail mode shows it in the top bar. */}
        <div className={cn("border-t border-white/10 p-3", rail && "lg:hidden")}>
          <div className="flex items-center gap-2.5 px-1 py-1">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-gold text-caption font-semibold text-navy-deep">
              {initial}
            </span>
            <span className="min-w-0">
              <span className="block truncate text-caption font-medium text-white" title={email}>
                {email}
              </span>
              <span className="block text-[0.7rem] text-white/50">{isStaff ? "Staff" : "Writer"}</span>
            </span>
          </div>
        </div>
      </aside>

      <div
        className={cn(
          "flex h-full min-h-0 min-w-0 flex-1 flex-col transition-[padding] duration-200",
          rail ? "lg:pl-[4.5rem]" : "lg:pl-[16.5rem]",
        )}
      >
        <header className="relative z-30 flex h-14 shrink-0 items-center gap-2.5 border-b border-line bg-surface px-3 sm:px-4">
          <button
            type="button"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-control border border-line text-ink hover:border-navy hover:text-navy"
            aria-expanded={narrow ? open : !rail}
            aria-label={narrow ? (open ? "Close menu" : "Open menu") : rail ? "Expand menu" : "Collapse menu"}
            onClick={toggleNav}
          >
            <PanelLeft className="h-4 w-4" aria-hidden="true" />
          </button>

          <div className="relative min-w-0 flex-1 max-w-md">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-subtle" aria-hidden />
            <input
              ref={searchRef}
              type="search"
              value={navQuery}
              onChange={(event) => {
                setNavQuery(event.target.value);
                setNavOpen(true);
              }}
              onFocus={() => setNavOpen(true)}
              onBlur={() => {
                // Allow click on results before closing.
                window.setTimeout(() => setNavOpen(false), 120);
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter" && navHits[0]) {
                  event.preventDefault();
                  goTo(navHits[0].href);
                }
              }}
              placeholder="Search console…"
              aria-label="Search admin console"
              aria-autocomplete="list"
              aria-controls="studio-nav-results"
              className="h-9 w-full rounded-control border border-line bg-surface-alt/70 pl-9 pr-14 text-small text-ink placeholder:text-ink-subtle focus:border-navy focus:bg-surface focus:outline-none focus:ring-1 focus:ring-navy"
            />
            <kbd className="pointer-events-none absolute right-2.5 top-1/2 hidden -translate-y-1/2 rounded border border-line bg-surface px-1.5 py-0.5 text-[0.65rem] font-medium text-ink-subtle sm:inline">
              ⌘K
            </kbd>
            {navOpen && navHits.length > 0 ? (
              <ul
                id="studio-nav-results"
                className="absolute left-0 right-0 top-[calc(100%+0.35rem)] z-40 max-h-72 overflow-y-auto rounded-control border border-line bg-surface py-1 shadow-pop"
              >
                {navHits.map((link) => {
                  const Icon = link.icon;
                  return (
                    <li key={link.href}>
                      <button
                        type="button"
                        className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-small hover:bg-navy-tint"
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => goTo(link.href)}
                      >
                        <Icon className="h-3.5 w-3.5 shrink-0 text-ink-muted" aria-hidden />
                        <span className="min-w-0 flex-1 truncate font-medium text-ink">{link.label}</span>
                        <span className="shrink-0 text-caption text-ink-subtle">{link.group}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            ) : null}
          </div>

          <div className="ml-auto flex shrink-0 items-center gap-2">
            <div className="relative" ref={createRef}>
              <button
                type="button"
                className="inline-flex h-9 items-center gap-1.5 rounded-control bg-navy px-3 text-caption font-medium text-white hover:bg-navy-deep"
                aria-expanded={createOpen}
                aria-haspopup="menu"
                onClick={() => setCreateOpen((value) => !value)}
              >
                <Plus className="h-3.5 w-3.5" aria-hidden />
                Create
                <ChevronDown className="h-3.5 w-3.5 opacity-80" aria-hidden />
              </button>
              {createOpen ? (
                <ul
                  role="menu"
                  className="absolute right-0 top-[calc(100%+0.35rem)] z-40 min-w-[12.5rem] rounded-control border border-line bg-surface py-1 shadow-pop"
                >
                  {createLinks.map((link) => (
                    <li key={link.href} role="none">
                      <Link
                        role="menuitem"
                        href={link.href}
                        className="block px-3 py-2 text-small text-ink hover:bg-navy-tint"
                        onClick={() => setCreateOpen(false)}
                      >
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>

            <Link
              href="/"
              className="hidden h-9 items-center gap-1.5 rounded-control border border-line px-3 text-caption font-medium text-ink hover:border-navy hover:text-navy sm:inline-flex"
            >
              View site
              <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
            </Link>

            <div
              className="hidden items-center gap-2 rounded-control border border-line py-1 pl-1 pr-2.5 lg:flex"
              title={`${email} · ${isStaff ? "Staff" : "Writer"}`}
            >
              <span className="grid h-7 w-7 place-items-center rounded-md bg-navy text-[0.7rem] font-semibold text-white">
                {initial}
              </span>
              <span className="max-w-[9rem] truncate text-caption font-medium text-ink">{email.split("@")[0] || "Account"}</span>
            </div>
          </div>
        </header>
        <main id="main" className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          <div className="mx-auto w-full max-w-[1440px] px-3 py-5 sm:px-4 sm:py-6 lg:px-5 lg:py-6">{children}</div>
        </main>
      </div>
    </div>
  );
}
