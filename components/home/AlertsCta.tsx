"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/providers/AuthProvider";
import { Button } from "@/components/ui/Button";
import { defaultSearchName, toSavedFilters } from "@/lib/api/savedSearches";
import { SEARCH_PROPERTY_TYPES } from "@/lib/types/domain";
import type { ListingQuery } from "@/lib/types/domain";
import { useFollowArea } from "@/lib/queries/watched";
import { useSavedSearch, useSavedSearchActions } from "@/lib/queries/savedSearches";
import { textOf } from "@/lib/site/read";
import { normalizePostal } from "@/lib/utils/postal";
import { cn } from "@/lib/utils/cn";

/**
 * Homepage Smart alerts — matches the HomeAtlasUI navy + white card layout.
 *
 * Area / postal + property type + max price become a daily saved-search alert.
 * Guests enter an email then sign up; signed-in users get the account mailbox.
 */

const PRICE_OPTIONS = [
  { label: "Any Price", value: "" },
  { label: "$500K", value: "500000" },
  { label: "$750K", value: "750000" },
  { label: "$1M", value: "1000000" },
  { label: "$1.5M", value: "1500000" },
  { label: "$2M", value: "2000000" },
  { label: "$3M", value: "3000000" },
] as const;

const DEFAULT_ALERTS = [
  {
    key: "newListings",
    label: "New Listings",
    description: "Be first to see new properties.",
  },
  {
    key: "priceChanges",
    label: "Price Drops",
    description: "Get notified on reductions.",
  },
  {
    key: "statusUpdates",
    label: "Smart Match",
    description: "Based on your criteria.",
  },
] as const;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const FIELD =
  "w-full rounded-xl border border-line bg-surface px-4 py-3 text-small text-ink outline-none transition-colors placeholder:text-ink-subtle focus:border-navy/35 focus:ring-2 focus:ring-navy/10";

export function AlertsCta({ content }: { content?: Record<string, unknown> }) {
  const { user, openAuth } = useAuth();
  const router = useRouter();
  const { saved } = useSavedSearch();
  const { save } = useSavedSearchActions();
  const followArea = useFollowArea();

  const [area, setArea] = useState("");
  const [type, setType] = useState("");
  const [priceMax, setPriceMax] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (user?.email) setEmail(user.email);
  }, [user?.email]);

  const saving = save.isPending || followArea.isPending;

  const alerts = Array.isArray(content?.alerts)
    ? (content.alerts as Array<Record<string, unknown>>).map((row, index) => ({
        key: String(row.key ?? DEFAULT_ALERTS[index]?.key ?? index),
        label: String(row.label ?? DEFAULT_ALERTS[index]?.label ?? "Alert"),
        description: String(row.description ?? DEFAULT_ALERTS[index]?.description ?? ""),
      }))
    : [...DEFAULT_ALERTS];

  async function createAlert() {
    const trimmedArea = area.trim();
    const postal = normalizePostal(trimmedArea);
    const query: ListingQuery = {
      ...(postal ? { postalCodes: [postal] } : { city: trimmedArea }),
      type: type || undefined,
      priceMax: priceMax ? Number(priceMax) : undefined,
      status: "Active",
      transaction: "sale",
    };
    const filters = toSavedFilters(query);
    const name = defaultSearchName(query);

    await save.mutateAsync({
      name,
      filters,
      alertCadence: "daily",
      replaceId: saved?.id,
    });

    if (!postal) {
      await followArea.mutateAsync({
        areaKey: trimmedArea.toLowerCase(),
        areaLabel: trimmedArea,
        areaKind: "community",
        follow: true,
      });
    }

    setDone(true);
    router.refresh();
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    const trimmedArea = area.trim();
    if (!trimmedArea) {
      setError("Enter an area or postal code.");
      return;
    }
    if (!EMAIL_RE.test(email.trim())) {
      setError("Enter a valid email address.");
      return;
    }

    if (!user) {
      openAuth("signup", () => {
        void createAlert().catch(() => {
          setError("We couldn't save that alert. Please try again.");
        });
      });
      return;
    }

    try {
      await createAlert();
    } catch {
      setError("We couldn't save that alert. Please try again.");
    }
  }

  return (
    <section
      id="smart-alerts"
      className="scroll-mt-24 bg-navy py-12 sm:py-14 lg:py-16 lg:scroll-mt-28"
    >
      <div className="container-page">
        <div className="grid items-center gap-8 lg:grid-cols-2 lg:gap-12 xl:gap-16">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/65">
              {textOf(content, "eyebrow", "Stay ahead of the market")}
            </p>
            <h2 className="mt-3 text-[2rem] font-semibold leading-tight tracking-tight text-white sm:text-[2.35rem]">
              {textOf(content, "title", "Smart Alerts")}
            </h2>
            <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-white/75 sm:text-body">
              {textOf(
                content,
                "description",
                "Create your own personalized search and receive daily updates. New listings, price drops, sold data, and matching preferences — all delivered directly to you.",
              )}
            </p>

            <ul className="mt-8 flex flex-col gap-3">
              {alerts.map((item) => (
                <li
                  key={item.key}
                  className="flex items-start gap-3 rounded-2xl bg-white/[0.08] px-4 py-3.5 ring-1 ring-white/10"
                >
                  <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/10 text-white">
                    <AlertIcon name={item.key} />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-small font-semibold text-white">{item.label}</span>
                    <span className="mt-0.5 block text-caption leading-snug text-white/65">
                      {item.description}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <div className="min-w-0 rounded-2xl bg-white p-5 shadow-xl shadow-black/20 sm:p-7 lg:p-8">
            {done ? (
              <AlertCreated
                area={area.trim()}
                email={user?.email ?? email.trim()}
                onAddAnother={() => setDone(false)}
                onViewSaved={() => router.push("/watched?tab=alerts")}
              />
            ) : (
              <form onSubmit={(event) => void handleSubmit(event)} className="space-y-4 sm:space-y-5">
                <h3 className="text-[1.25rem] font-semibold tracking-tight text-ink sm:text-[1.35rem]">
                  Create Your Search Alert
                </h3>

                <div>
                  <label htmlFor="alert-area" className="mb-1.5 block text-caption font-medium text-ink-muted">
                    Area or Postal Code
                  </label>
                  <input
                    id="alert-area"
                    type="text"
                    value={area}
                    onChange={(event) => setArea(event.target.value)}
                    placeholder="e.g. Vaughan, L7A, or Brampton"
                    autoComplete="address-level2"
                    className={FIELD}
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label htmlFor="alert-type" className="mb-1.5 block text-caption font-medium text-ink-muted">
                      Property Type
                    </label>
                    <select
                      id="alert-type"
                      value={type}
                      onChange={(event) => setType(event.target.value)}
                      className={cn(FIELD, "cursor-pointer")}
                    >
                      <option value="">Any Type</option>
                      {SEARCH_PROPERTY_TYPES.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label htmlFor="alert-price" className="mb-1.5 block text-caption font-medium text-ink-muted">
                      Max Price
                    </label>
                    <select
                      id="alert-price"
                      value={priceMax}
                      onChange={(event) => setPriceMax(event.target.value)}
                      className={cn(FIELD, "cursor-pointer")}
                    >
                      {PRICE_OPTIONS.map((option) => (
                        <option key={option.label} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label htmlFor="alert-email" className="mb-1.5 block text-caption font-medium text-ink-muted">
                    Your Email
                  </label>
                  <input
                    id="alert-email"
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="you@example.com"
                    autoComplete="email"
                    inputMode="email"
                    className={FIELD}
                  />
                </div>

                {error && (
                  <p role="alert" className="text-caption text-negative">
                    {error}
                  </p>
                )}

                <Button type="submit" variant="dark" size="lg" block loading={saving} className="rounded-xl">
                  Create Daily Alert →
                </Button>

                <p className="text-center text-caption text-ink-subtle">
                  Unsubscribe at any time · No spam, ever
                </p>
              </form>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function AlertIcon({ name }: { name: string }) {
  if (name === "priceChanges") {
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          d="M4 8l5 5 3.5-3.5L20 17"
          stroke="#f87171"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path d="M15 17h5v-5" stroke="#f87171" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  if (name === "statusUpdates") {
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle cx="12" cy="12" r="7.25" stroke="#f9a8d4" strokeWidth="1.8" />
        <circle cx="12" cy="12" r="3.25" stroke="currentColor" strokeWidth="1.8" />
        <circle cx="12" cy="12" r="1" fill="currentColor" />
      </svg>
    );
  }
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1v-9.5Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function AlertCreated({
  area,
  email,
  onAddAnother,
  onViewSaved,
}: {
  area: string;
  email: string;
  onAddAnother: () => void;
  onViewSaved: () => void;
}) {
  return (
    <div className="py-2 text-center sm:py-4">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-positive-soft">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="m5 13 4 4L19 7"
            stroke="var(--color-positive)"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
      <h3 className="mt-4 text-h3 text-ink">You&apos;re set{area ? ` for ${area}` : ""}</h3>
      <p className="mx-auto mt-2 max-w-sm text-small text-ink-muted">
        {email
          ? `We'll email ${email} with daily matches.`
          : "We'll email you with daily matches."}{" "}
        Manage this anytime from your saved homes.
      </p>
      <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-center">
        <Button type="button" variant="secondary" onClick={onAddAnother}>
          Adjust criteria
        </Button>
        <Button type="button" variant="dark" onClick={onViewSaved}>
          Manage alerts
        </Button>
      </div>
    </div>
  );
}
