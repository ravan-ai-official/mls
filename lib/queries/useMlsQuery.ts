"use client";

import { useQuery, type UseQueryResult } from "@tanstack/react-query";

/**
 * Thin React Query wrapper for MLS-backed loaders that previously ran in
 * Server Components via `safeFetch`. Failures return `fallback` so optional
 * homepage rails degrade instead of erroring the page.
 */
export function useMlsQuery<T>(
  key: readonly unknown[],
  loader: () => Promise<T>,
  fallback: T,
): UseQueryResult<T, Error> {
  return useQuery<T, Error, T, readonly unknown[]>({
    queryKey: key,
    queryFn: async (): Promise<T> => {
      try {
        return await loader();
      } catch (error) {
        if (process.env.NODE_ENV !== "production") {
          console.warn(
            `[mls] ${key.join(":")} failed:`,
            error instanceof Error ? error.message : error,
          );
        }
        return fallback;
      }
    },
    staleTime: 60_000,
  });
}
