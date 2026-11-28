"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import {
  featuredFiltersToListingsHref,
  hasFeaturedSearchFilters,
  LAST_SEARCH_COOKIE,
  parseLastSearchCookie,
} from "@/lib/personalize/lastSearch";

const SCROLL_KEY = "ha.listings.scroll";
const RETURN_KEY = "ha.listings.return";

/** Remember scroll + full /listings URL before leaving for a property detail. */
export function rememberListingsScroll() {
  if (typeof window === "undefined") return;
  try {
    const path = window.location.pathname + window.location.search;
    sessionStorage.setItem(
      SCROLL_KEY,
      JSON.stringify({ y: window.scrollY, path }),
    );
    if (path.startsWith("/listings")) {
      sessionStorage.setItem(RETURN_KEY, path);
    }
  } catch {
    /* private mode */
  }
}

/**
 * Href for “Back to listings” — prefers the exact filtered URL saved when the
 * visitor opened a card, then the last-search cookie, then bare /listings.
 */
export function readListingsReturnHref(): string {
  if (typeof window === "undefined") return "/listings";
  try {
    const saved = sessionStorage.getItem(RETURN_KEY);
    if (saved?.startsWith("/listings")) return saved;
  } catch {
    /* ignore */
  }
  try {
    const match = document.cookie.match(
      new RegExp(`(?:^|; )${LAST_SEARCH_COOKIE}=([^;]*)`),
    );
    // Cookie value is encodeURIComponent'd; parseLastSearchCookie decodes it.
    const filters = parseLastSearchCookie(match?.[1] ?? null);
    if (hasFeaturedSearchFilters(filters)) {
      return featuredFiltersToListingsHref(filters);
    }
  } catch {
    /* ignore */
  }
  return "/listings";
}

/**
 * Restore scroll when returning to /listings (e.g. browser back from a property).
 * Runs once after mount when a matching saved position exists.
 */
export function useListingsScrollRestore() {
  const pathname = usePathname();

  useEffect(() => {
    if (pathname !== "/listings") return;
    try {
      const raw = sessionStorage.getItem(SCROLL_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw) as { y?: number; path?: string };
      const here = window.location.pathname + window.location.search;
      if (!saved.path || saved.path.split("?")[0] !== "/listings") return;
      // Same filter set (ignore presentation-only diffs) — restore position.
      const savedQs = new URLSearchParams(saved.path.split("?")[1] ?? "");
      const hereQs = new URLSearchParams(here.split("?")[1] ?? "");
      savedQs.delete("view");
      hereQs.delete("view");
      savedQs.sort();
      hereQs.sort();
      if (savedQs.toString() !== hereQs.toString()) return;
      const y = typeof saved.y === "number" ? saved.y : 0;
      sessionStorage.removeItem(SCROLL_KEY);
      requestAnimationFrame(() => {
        window.scrollTo({
          top: y,
          behavior: "instant" in window ? ("instant" as ScrollBehavior) : "auto",
        });
      });
    } catch {
      /* ignore */
    }
  }, [pathname]);
}
