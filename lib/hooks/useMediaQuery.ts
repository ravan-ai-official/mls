"use client";

import { useEffect, useState } from "react";

/**
 * Subscribe to a CSS media query. Starts as `false` on the server / first paint
 * so SSR and hydration match; updates after mount.
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    const media = window.matchMedia(query);
    const sync = () => setMatches(media.matches);
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, [query]);

  return matches;
}
