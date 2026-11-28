"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import { readListingsReturnHref } from "@/lib/hooks/useListingsScrollRestore";

/**
 * “Back to listings” that restores the filtered /listings URL the visitor
 * left from (session), instead of wiping filters with a bare /listings link.
 */
export function BackToListingsLink({ className }: { className?: string }) {
  const href = useSyncExternalStore(
    subscribeNoop,
    readListingsReturnHref,
    () => "/listings",
  );

  return (
    <Link href={href} className={className}>
      <svg width="16" height="16" viewBox="0 0 18 18" fill="none" aria-hidden="true">
        <path
          d="M14.25 9H3.75M9 14.25L3.75 9L9 3.75"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      Back to listings
    </Link>
  );
}

function subscribeNoop() {
  return () => {};
}
