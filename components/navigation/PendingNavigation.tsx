"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useOptimistic,
  useTransition,
  type ComponentProps,
  type MouseEvent,
  type ReactNode,
} from "react";

/**
 * Instant feedback for URL-driven pages (filters, tabs, pagination).
 *
 * These pages re-render on the server when the URL changes, and Next keeps
 * the old screen until the new one is ready — so a clicked chip stayed
 * unselected and the old results stayed up with no sign anything happened.
 *
 * The provider runs each navigation in a transition and remembers its target
 * optimistically. Controls read `usePendingSearchParams()` (the URL being
 * navigated TO) so they flip on click, and `<PendingContent>` swaps the
 * results for a skeleton until the new page arrives. Outside a provider every
 * hook degrades to plain router navigation.
 */

interface NavigateOptions {
  replace?: boolean;
  scroll?: boolean;
}

interface PendingNavigationValue {
  navigate: (href: string, options?: NavigateOptions) => void;
  isPending: boolean;
  /** The href being navigated to, while a navigation is in flight. */
  target: string | null;
}

const PendingNavigationContext = createContext<PendingNavigationValue | null>(null);

export function PendingNavigationProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [target, setTarget] = useOptimistic<string | null>(null);

  const navigate = useCallback(
    (href: string, options: NavigateOptions = {}) => {
      startTransition(() => {
        setTarget(href);
        if (options.replace) router.replace(href, { scroll: options.scroll });
        else router.push(href, { scroll: options.scroll });
      });
    },
    [router, setTarget],
  );

  const value = useMemo(() => ({ navigate, isPending, target }), [navigate, isPending, target]);
  return <PendingNavigationContext.Provider value={value}>{children}</PendingNavigationContext.Provider>;
}

export function usePendingNavigation(): PendingNavigationValue {
  const context = useContext(PendingNavigationContext);
  const router = useRouter();
  const fallback = useMemo<PendingNavigationValue>(
    () => ({
      navigate: (href, options = {}) =>
        options.replace
          ? router.replace(href, { scroll: options.scroll })
          : router.push(href, { scroll: options.scroll }),
      isPending: false,
      target: null,
    }),
    [router],
  );
  return context ?? fallback;
}

const BASE = "http://local";

/** `/listings?b=2&a=1` and `/listings?a=1&b=2` are the same destination. */
export function sameHref(a: string, b: string): boolean {
  const x = new URL(a, BASE);
  const y = new URL(b, BASE);
  if (x.pathname !== y.pathname) return false;
  x.searchParams.sort();
  y.searchParams.sort();
  return x.searchParams.toString() === y.searchParams.toString();
}

/**
 * The search params the page is showing — or, mid-navigation, the ones it is
 * about to show, so selected states update on click.
 */
export function usePendingSearchParams(): URLSearchParams {
  const params = useSearchParams();
  const pathname = usePathname();
  const { target } = usePendingNavigation();
  const current = params.toString();

  return useMemo(() => {
    if (target) {
      const url = new URL(target, BASE);
      if (url.pathname === pathname) return new URLSearchParams(url.search);
    }
    return new URLSearchParams(current);
  }, [target, pathname, current]);
}

/**
 * True when `href` is where the page is heading; else `current` (the
 * server's answer). For "which chip / page is selected" during navigation.
 */
export function useIsActiveHref(href: string, current: boolean): boolean {
  const { target } = usePendingNavigation();
  return target ? sameHref(href, target) : current;
}

/**
 * A Link whose plain left-clicks go through the pending navigation. Modified
 * clicks (new tab, etc.) keep the browser's behaviour, and it stays a real
 * `<a href>` for crawlers and prefetching.
 */
export function PendingLink({
  href,
  replace,
  scroll,
  onClick,
  ...props
}: Omit<ComponentProps<typeof Link>, "href"> & { href: string }) {
  const { navigate } = usePendingNavigation();

  function handleClick(event: MouseEvent<HTMLAnchorElement>) {
    onClick?.(event);
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey ||
      props.target === "_blank"
    ) {
      return;
    }
    event.preventDefault();
    navigate(href, { replace, scroll });
  }

  return <Link href={href} replace={replace} scroll={scroll} onClick={handleClick} {...props} />;
}

/**
 * Shows `fallback` (a skeleton) while a navigation is in flight — except for
 * soft navigations that only change presentation (`view`). Those must keep the
 * current results painted so grid ↔ list does not flash empty.
 */
export function PendingContent({ fallback, children }: { fallback: ReactNode; children: ReactNode }) {
  const { isPending, target } = usePendingNavigation();
  const params = useSearchParams();
  const pathname = usePathname();
  const soft =
    Boolean(target) && isPresentationOnlyNav(pathname, params.toString(), target!);
  const showFallback = isPending && !soft;
  return <div aria-busy={showFallback || undefined}>{showFallback ? fallback : children}</div>;
}

/** True when the destination differs from the current URL only by `view`. */
function isPresentationOnlyNav(
  pathname: string,
  currentSearch: string,
  targetHref: string,
): boolean {
  const url = new URL(targetHref, BASE);
  if (url.pathname !== pathname) return false;
  const current = new URLSearchParams(currentSearch);
  const next = new URLSearchParams(url.search);
  current.delete("view");
  next.delete("view");
  current.sort();
  next.sort();
  return current.toString() === next.toString();
}
