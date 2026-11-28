"use client";

import { useState } from "react";
import { useAuth } from "@/components/providers/AuthProvider";
import { fromBackendParams, searchIdentity } from "@/lib/api/savedSearches";
import type { ListingQuery } from "@/lib/types/domain";
import { cn } from "@/lib/utils/cn";
import { SaveSearchModal } from "./SaveSearchModal";
import { useSavedSearch } from "@/lib/queries/savedSearches";

/**
 * Save-search control. Quiet = chip-rail companion; emphasized = gold CTA
 * when there is room for a labeled button.
 */
export function SaveSearchButton({
  query,
  className,
  variant = "emphasized",
}: {
  query: ListingQuery;
  className?: string;
  /** `emphasized` draws the eye on listings; `quiet` for denser panels. */
  variant?: "emphasized" | "quiet";
}) {
  const { user, openAuth } = useAuth();
  const { saved } = useSavedSearch();
  const [open, setOpen] = useState(false);

  const isSaved =
    saved !== null &&
    searchIdentity(fromBackendParams(saved.filters)) === searchIdentity(query);

  const onClick = () => {
    if (!user) {
      openAuth("login", () => setOpen(true));
      return;
    }
    setOpen(true);
  };

  return (
    <>
      <button
        type="button"
        onClick={onClick}
        aria-haspopup="dialog"
        aria-label={isSaved ? "Search saved" : "Save this search"}
        className={cn(
          "group inline-flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap font-semibold transition-colors",
          variant === "emphasized" &&
            "h-9 rounded-full px-0 text-caption sm:h-10 sm:px-4 sm:text-small",
          variant === "emphasized" &&
            (isSaved
              ? "w-9 bg-navy text-white hover:bg-navy-deep sm:w-auto"
              : "w-9 border border-line bg-surface text-ink hover:border-navy hover:text-navy sm:w-auto sm:border-transparent sm:bg-gold sm:text-ink sm:hover:bg-gold-deep"),
          variant === "quiet" &&
            "h-9 w-9 rounded-full border border-line px-0 text-caption sm:h-10 sm:w-auto sm:px-3.5 sm:text-small",
          variant === "quiet" &&
            (isSaved
              ? "border-transparent bg-navy text-white hover:bg-navy-deep"
              : "bg-surface text-ink hover:border-navy hover:text-navy"),
          className,
        )}
      >
        {isSaved ? <CheckIcon /> : <BookmarkIcon />}
        <span
          className={cn(
            "hidden sm:inline",
            variant === "emphasized" && "sm:inline",
          )}
        >
          {isSaved ? "Saved" : variant === "quiet" ? "Save" : "Save this search"}
        </span>
      </button>
      {open && <SaveSearchModal query={query} onClose={() => setOpen(false)} />}
    </>
  );
}

function BookmarkIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 18 18" fill="none" aria-hidden="true" className="shrink-0">
      <path
        d="M4.5 2.25h9A.75.75 0 0 1 14.25 3v12.45l-4.72-2.7a.75.75 0 0 0-.76 0l-4.72 2.7V3a.75.75 0 0 1 .75-.75Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 18 18" fill="none" aria-hidden="true" className="shrink-0">
      <path
        d="M3.75 9.75 7.5 13.5l6.75-9"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
