"use client";

import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  StudioAlert,
  StudioEmpty,
  StudioPage,
  StudioPanel,
  studioSearch,
  studioTable,
  studioTableWrap,
  studioTd,
  studioTh,
} from "@/components/studio/chrome";
import { Button } from "@/components/ui/Button";
import { FeaturedBoardSkeleton } from "@/components/studio/StudioSkeletons";
import { useUserKeys } from "@/components/providers/AuthProvider";
import { fetchJson } from "@/lib/queries/fetcher";
import { useHighReturnListings, type HighReturnBody } from "@/lib/queries/siteStudio";
import { formatPrice, toNumber } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";

type ListingPin = HighReturnBody["pins"][number];

function sortPins(pins: ListingPin[]) {
  return [...pins].sort((a, b) => {
    const ao = a.high_return_order ?? Number.POSITIVE_INFINITY;
    const bo = b.high_return_order ?? Number.POSITIVE_INFINITY;
    if (ao !== bo) return ao - bo;
    return (a.address || a.listing_key).localeCompare(b.address || b.listing_key);
  });
}

function listingLabel(listing: ListingPin) {
  return listing.address || listing.listing_key;
}

function listingMeta(listing: ListingPin) {
  const parts = [
    listing.city || null,
    formatPrice(toNumber(listing.list_price)),
    listing.standard_status || null,
    listing.listing_key ? `MLS® ${listing.listing_key}` : null,
  ].filter((part) => part && part !== "—");
  return parts.join(" · ");
}

export function HighReturnManager({ initial }: { initial: HighReturnBody }) {
  const keys = useUserKeys();
  const queryClient = useQueryClient();
  const [query, setQuery] = useState("");
  const [submitted, setSubmitted] = useState("");
  const list = useHighReturnListings(initial, submitted);
  const pins = useMemo(() => sortPins(list.data?.pins ?? []), [list.data?.pins]);
  const results = list.data?.results ?? [];
  const searching = list.isFetching && list.isPlaceholderData;
  const [error, setError] = useState<string | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const busy = busyKey !== null;

  function search(event: React.FormEvent) {
    event.preventDefault();
    setSubmitted(query.trim());
  }

  async function refresh() {
    if (keys) await queryClient.invalidateQueries({ queryKey: keys.highReturnAll });
  }

  async function updatePin(listing: ListingPin, pinned: boolean, order: number | null) {
    setBusyKey(listing.listing_key);
    setError(null);
    try {
      await fetchJson(`/api/studio/high-return`, {
        method: "PATCH",
        body: {
          listing_key: listing.listing_key,
          is_high_return: pinned,
          high_return_order: order,
          high_return_until: null,
        },
        fallback: "Could not update that listing.",
      });
      await refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not update that listing.");
    } finally {
      setBusyKey(null);
    }
  }

  async function addToRail(listing: ListingPin) {
    await updatePin(listing, true, pins.length + 1);
  }

  async function removeFromRail(listing: ListingPin) {
    setBusyKey(listing.listing_key);
    setError(null);
    try {
      await fetchJson(`/api/studio/high-return`, {
        method: "PATCH",
        body: {
          listing_key: listing.listing_key,
          is_high_return: false,
          high_return_order: null,
          high_return_until: null,
        },
        fallback: "Could not update that listing.",
      });
      const remaining = pins.filter((pin) => pin.listing_key !== listing.listing_key);
      await Promise.all(
        remaining.map((pin, index) =>
          fetchJson(`/api/studio/high-return`, {
            method: "PATCH",
            body: {
              listing_key: pin.listing_key,
              is_high_return: true,
              high_return_order: index + 1,
              high_return_until: null,
            },
            fallback: "Could not update that listing.",
          }),
        ),
      );
      await refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not update that listing.");
    } finally {
      setBusyKey(null);
    }
  }

  async function move(index: number, direction: -1 | 1) {
    const next = index + direction;
    if (next < 0 || next >= pins.length) return;
    const reordered = [...pins];
    const [item] = reordered.splice(index, 1);
    reordered.splice(next, 0, item);
    setBusyKey(item.listing_key);
    setError(null);
    try {
      await Promise.all(
        reordered.map((pin, order) =>
          fetchJson(`/api/studio/high-return`, {
            method: "PATCH",
            body: {
              listing_key: pin.listing_key,
              is_high_return: true,
              high_return_order: order + 1,
              high_return_until: null,
            },
            fallback: "Could not update that listing.",
          }),
        ),
      );
      await refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not update that listing.");
    } finally {
      setBusyKey(null);
    }
  }

  if (list.isPending && !list.data) return <FeaturedBoardSkeleton />;

  const pinnedKeys = new Set(pins.map((pin) => pin.listing_key));

  return (
    <StudioPage
      title="High return homes"
      description="Pinned MLS® listings lead the homepage High return rail. Position 1 shows first; empty slots fill from the yield feed."
      toolbar={
        <form onSubmit={search} className="flex flex-wrap items-center gap-2">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Address, city, or MLS® number"
            aria-label="Search listings"
            className={cn(studioSearch, "sm:w-72")}
          />
          <Button type="submit" variant="primary" size="sm" disabled={busy || searching}>
            {searching ? "Searching…" : "Search"}
          </Button>
        </form>
      }
    >
      {(error || list.isError) && (
        <StudioAlert>
          {error || (list.error instanceof Error ? list.error.message : "Could not search listings.")}
        </StudioAlert>
      )}

      <div className="space-y-4">
        <StudioPanel title="Search results" description="Add an active MLS® listing to the homepage rail.">
          {!submitted ? (
            <p className="text-small text-ink-muted">Search above to find a listing.</p>
          ) : results.length === 0 && !searching ? (
            <p className="text-small text-ink-muted">
              No active listings matched “{submitted}”. Try a shorter address or the MLS® number.
            </p>
          ) : (
            <div className={studioTableWrap}>
              <table className={cn(studioTable, "min-w-[36rem]")}>
                <thead>
                  <tr>
                    <th scope="col" className={studioTh}>
                      Listing
                    </th>
                    <th scope="col" className={studioTh}>
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {results.map((listing) => {
                    const onRail = pinnedKeys.has(listing.listing_key) || listing.is_high_return;
                    const isBusy = busyKey === listing.listing_key;
                    return (
                      <tr key={listing.listing_key}>
                        <td className={studioTd}>
                          <span className="studio-cell-title">{listingLabel(listing)}</span>
                          <span className="studio-cell-meta">{listingMeta(listing)}</span>
                        </td>
                        <td className={studioTd}>
                          <div className="flex justify-end">
                            <Button
                              type="button"
                              variant={onRail ? "secondary" : "primary"}
                              size="sm"
                              disabled={busy || onRail}
                              loading={isBusy}
                              onClick={() => void addToRail(listing)}
                            >
                              {onRail ? "Already on rail" : "Add to rail"}
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </StudioPanel>

        <StudioPanel
          title="Homepage rail"
          description="Order on the public High return section."
          action={
            pins.length > 0 ? (
              <span className="rounded-control bg-surface-alt px-2.5 py-1 text-caption font-medium text-ink-muted">
                {pins.length} pinned
              </span>
            ) : null
          }
        >
          {pins.length === 0 ? (
            <StudioEmpty title="Nothing pinned yet">
              Search above and choose Add to rail. Until then, the public homepage fills this section from the yield feed.
            </StudioEmpty>
          ) : (
            <div className={studioTableWrap}>
              <table className={cn(studioTable, "min-w-[40rem]")}>
                <thead>
                  <tr>
                    <th scope="col" className={studioTh}>
                      #
                    </th>
                    <th scope="col" className={studioTh}>
                      Listing
                    </th>
                    <th scope="col" className={studioTh}>
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {pins.map((listing, index) => {
                    const isBusy = busyKey === listing.listing_key;
                    return (
                      <tr key={listing.listing_key} className={cn(isBusy && "opacity-70")}>
                        <td className={cn(studioTd, "w-12 tabular-nums text-ink-muted")}>{index + 1}</td>
                        <td className={studioTd}>
                          <span className="studio-cell-title">{listingLabel(listing)}</span>
                          <span className="studio-cell-meta">{listingMeta(listing)}</span>
                        </td>
                        <td className={studioTd}>
                          <div className="flex justify-end gap-1">
                            <IconAction
                              label={`Move ${listingLabel(listing)} up`}
                              onClick={() => void move(index, -1)}
                              disabled={busy || index === 0}
                            >
                              ↑
                            </IconAction>
                            <IconAction
                              label={`Move ${listingLabel(listing)} down`}
                              onClick={() => void move(index, 1)}
                              disabled={busy || index === pins.length - 1}
                            >
                              ↓
                            </IconAction>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              disabled={busy}
                              loading={isBusy}
                              onClick={() => void removeFromRail(listing)}
                            >
                              Remove
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </StudioPanel>
      </div>
    </StudioPage>
  );
}

function IconAction({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      className="flex h-9 w-9 items-center justify-center rounded-control border border-line text-ink-muted transition-colors hover:border-navy hover:text-navy disabled:opacity-40"
    >
      {children}
    </button>
  );
}
