"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import dynamic from "next/dynamic";
import { useState, type ReactNode } from "react";
import { shouldRetry } from "@/lib/queries/fetcher";

// Dev-only and lazily loaded, so production bundles never include it.
const Devtools =
  process.env.NODE_ENV === "development"
    ? dynamic(
        () =>
          import("@tanstack/react-query-devtools").then((mod) => mod.ReactQueryDevtools),
        { ssr: false },
      )
    : () => null;

/**
 * TanStack Query client.
 *
 * Created inside a `useState` initialiser rather than at module scope: a
 * module-level client would be shared across every request on the server and
 * leak one user's cached data into another's render.
 *
 * These are defaults; each domain's `queryOptions` (lib/queries/*) sets its
 * own staleTime where the data class calls for it.
 */
export function QueryProvider({ children }: { children: ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // MLS / market data moves on a feed cadence. Keep client caches
            // warm across navigations so back/forward and shared keys feel instant.
            staleTime: 3 * 60_000,
            gcTime: 30 * 60_000,
            // Network / 5xx once; never 4xx — a 401 or 404 won't change on retry.
            retry: shouldRetry,
            // The window regaining focus is not a signal that MLS data moved.
            refetchOnWindowFocus: false,
            refetchOnReconnect: false,
          },
          mutations: {
            // Writes are never retried automatically: a timed-out POST may
            // have succeeded, and repeating it could double-submit.
            retry: false,
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={client}>
      {children}
      <Devtools initialIsOpen={false} buttonPosition="bottom-left" />
    </QueryClientProvider>
  );
}
