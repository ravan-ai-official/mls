"use client";

import { useEffect, useRef, useState } from "react";
import { StudioBack } from "@/components/studio/chrome";
import { DocumentEditor } from "@/components/studio/site/DocumentEditor";
import { TextControl } from "@/components/studio/site/fields";
import { Button, LinkButton } from "@/components/ui/Button";
import { ChipToggle } from "@/components/ui/Field";
import {
  CURATED_GROUPS,
  CURATED_LISTING_KEYS_MAX,
  curatedPath,
  formatCuratedPostal,
  normalizeListingKeys,
  type CuratedDocument,
  type CuratedGroup,
  type CuratedPage,
} from "@/lib/seo/curatedPages";
import {
  BASEMENT_OPTIONS,
  BATH_OPTIONS,
  BED_OPTIONS,
  BUILDING_OPTIONS,
  DOM_OPTIONS,
  FLOOR_OPTIONS,
  GARAGE_OPTIONS,
  KITCHEN_OPTIONS,
  OWNERSHIP_OPTIONS,
  YEAR_BUILT_MIN_OPTIONS,
} from "@/lib/search/listingFilterOptions";
import { SEARCH_PROPERTY_TYPES, type ListingQuery } from "@/lib/types/domain";
import { validateCurated, type FieldErrors } from "@/lib/site/validate";
import { cn } from "@/lib/utils/cn";
import { parsePostalList } from "@/lib/utils/postal";
import { STATUS_TABS } from "@/lib/utils/status";

function emptyPage(): CuratedPage {
  return {
    slug: "",
    label: "",
    h1: "",
    description: "",
    group: "Deals",
    query: { status: "Active" },
    listingKeys: undefined,
    enabled: true,
  };
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function positiveOrUndefined(value: string): number | undefined {
  const digits = value.replace(/\D/g, "");
  if (!digits) return undefined;
  const n = Number(digits);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

export function KeywordsEditor({ mode = "list" }: { mode?: "list" | "create" }) {
  const creating = mode === "create";
  return (
    <div className="space-y-4">
      {creating ? <StudioBack href="/studio/keywords">Back to keyword searches</StudioBack> : null}
      <DocumentEditor
        siteKey="curated"
        title={creating ? "New keyword search" : "Keyword searches"}
        lede={
          creating
            ? "Fill in this search, then Save draft (and Publish when you want it live). Editing existing searches stays on the keyword list."
            : "Map each public keyword chip to a search definition: the same MLS filters as /listings, and/or pinned MLS® numbers. Publish to update the homepage block, /homes pages, and the site map — no code deploy. City pages (Condos in Toronto, …) stay automatic."
        }
        validate={validateCurated}
        previewOf={(draft) => ({ kind: "curated", document: draft })}
      >
        {(draft, update, errors) => (
          <KeywordsForm
            document={draft as CuratedDocument}
            errors={errors}
            onChange={(next) => update(next)}
            mode={mode}
          />
        )}
      </DocumentEditor>
    </div>
  );
}

function KeywordsForm({
  document,
  errors,
  onChange,
  mode = "list",
}: {
  document: CuratedDocument;
  errors: FieldErrors;
  onChange: (next: CuratedDocument) => void;
  mode?: "list" | "create";
}) {
  const pages = Array.isArray(document.pages) ? document.pages : [];
  const creating = mode === "create";
  const seeded = useRef(false);
  /** Stable list keys — never derive from slug or the row remounts on first keystroke. */
  const rowIds = useRef<string[]>([]);
  /** Indexes where the admin typed the slug manually; stop auto-syncing from the label. */
  const slugLocked = useRef<Set<number>>(new Set());
  const [openIndex, setOpenIndex] = useState<number | null>(pages.length ? 0 : null);

  function ensureRowIds(count: number) {
    while (rowIds.current.length < count) {
      rowIds.current.push(`kw-${rowIds.current.length}-${Math.random().toString(36).slice(2, 9)}`);
    }
  }
  ensureRowIds(pages.length);

  useEffect(() => {
    if (!creating || seeded.current) return;
    seeded.current = true;
    const next = [...pages, emptyPage()];
    rowIds.current.push(`kw-new-${Math.random().toString(36).slice(2, 9)}`);
    onChange({ ...document, pages: next });
    setOpenIndex(next.length - 1);
    // Seed once when the create page mounts with the loaded draft.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional one-shot seed
  }, [creating]);

  function setPages(next: CuratedPage[]) {
    onChange({ ...document, pages: next });
  }

  function patch(index: number, pagePatch: Partial<CuratedPage>) {
    setPages(pages.map((page, i) => (i === index ? { ...page, ...pagePatch } : page)));
  }

  function patchQuery(index: number, queryPatch: Partial<ListingQuery>) {
    const page = pages[index];
    if (!page) return;
    const next: Partial<ListingQuery> = { ...page.query, ...queryPatch };
    for (const [key, value] of Object.entries(queryPatch)) {
      if (value === undefined) delete next[key as keyof ListingQuery];
    }
    patch(index, { query: next });
  }

  function removePage(index: number) {
    const next = pages.filter((_, i) => i !== index);
    rowIds.current = rowIds.current.filter((_, i) => i !== index);
    const locked = new Set<number>();
    slugLocked.current.forEach((lockedIndex) => {
      if (lockedIndex < index) locked.add(lockedIndex);
      else if (lockedIndex > index) locked.add(lockedIndex - 1);
    });
    slugLocked.current = locked;
    setPages(next);
    setOpenIndex((current) => {
      if (current === null) return null;
      if (current === index) return next.length ? Math.min(index, next.length - 1) : null;
      if (current > index) return current - 1;
      return current;
    });
  }

  function move(index: number, delta: number) {
    const target = index + delta;
    if (target < 0 || target >= pages.length) return;
    const next = [...pages];
    const [row] = next.splice(index, 1);
    next.splice(target, 0, row);
    const ids = [...rowIds.current];
    const [id] = ids.splice(index, 1);
    ids.splice(target, 0, id);
    rowIds.current = ids;
    if (slugLocked.current.has(index) || slugLocked.current.has(target)) {
      const locked = new Set<number>();
      slugLocked.current.forEach((lockedIndex) => {
        if (lockedIndex === index) locked.add(target);
        else if (lockedIndex === target) locked.add(index);
        else locked.add(lockedIndex);
      });
      slugLocked.current = locked;
    }
    setPages(next);
    setOpenIndex(target);
  }

  const visibleIndexes = creating
    ? pages.length
      ? [pages.length - 1]
      : []
    : pages.map((_, index) => index);

  return (
    <div className="space-y-4">
      {errors.pages ? <p className="text-small text-red-700">{errors.pages}</p> : null}
      {!creating ? (
        <div className="flex flex-wrap items-center justify-end gap-2">
          <p className="mr-auto text-caption text-ink-muted">
            {pages.length} search{pages.length === 1 ? "" : "es"}. Disabled rows stay in the draft.
          </p>
          <LinkButton href="/studio/keywords/new" variant="primary" size="sm">
            + Add search
          </LinkButton>
        </div>
      ) : (
        <p className="text-small text-ink-muted">
          This page only creates a new search. Save draft when you are done, then publish from the keyword list when it should go live.
        </p>
      )}

      {pages.length === 0 ? (
        <p className="border border-dashed border-line px-4 py-8 text-center text-small text-ink-muted">
          No searches yet.{" "}
          <LinkButton href="/studio/keywords/new" variant="secondary" size="sm" className="ml-1 align-middle">
            Add search
          </LinkButton>
        </p>
      ) : (
        <ul className="divide-y divide-line border border-line bg-surface">
          {visibleIndexes.map((index) => {
            const page = pages[index];
            if (!page) return null;
            const open = creating || openIndex === index;
            const keywordsText = (page.query.keywords ?? []).join(", ");
            const listingKeysText = (page.listingKeys ?? []).join(", ");
            const pinCount = page.listingKeys?.length ?? 0;
            const isRent = page.query.transaction === "rent";
            return (
              <li
                key={rowIds.current[index] ?? `page-${index}`}
                className={cn(page.enabled === false && "opacity-70")}
              >
                {!creating ? (
                  <div className="flex flex-wrap items-center gap-2 px-3.5 py-2.5">
                    <button
                      type="button"
                      className="min-w-0 flex-1 text-left"
                      onClick={() => setOpenIndex(open ? null : index)}
                    >
                      <span className="studio-cell-title">{page.label || "Untitled search"}</span>
                      <span className="studio-cell-meta">
                        {page.group}
                        {page.slug ? ` · /homes/${page.slug}` : ""}
                        {pinCount > 0 ? ` · ${pinCount} MLS® pin${pinCount === 1 ? "" : "s"}` : " · filter search"}
                        {page.enabled === false ? " · hidden" : ""}
                      </span>
                    </button>
                    <div className="flex shrink-0 items-center gap-1">
                      <Button type="button" variant="ghost" size="sm" disabled={index === 0} onClick={() => move(index, -1)}>
                        Up
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={index === pages.length - 1}
                        onClick={() => move(index, 1)}
                      >
                        Down
                      </Button>
                      <Button
                        type="button"
                        variant={open ? "secondary" : "ghost"}
                        size="sm"
                        onClick={() => setOpenIndex(open ? null : index)}
                      >
                        {open ? "Close" : "Edit"}
                      </Button>
                      <Button type="button" variant="ghost" size="sm" onClick={() => removePage(index)}>
                        Remove
                      </Button>
                    </div>
                  </div>
                ) : null}

                {open ? (
                  <div className={cn("grid gap-4 p-4 sm:grid-cols-2", !creating && "border-t border-line bg-surface-alt/40")}>
                    <TextControl
                      label="Chip label"
                      value={page.label}
                      max={60}
                      error={errors[`pages.${index}.label`]}
                      onChange={(label) => {
                        const next: Partial<CuratedPage> = { label };
                        // Keep slug in sync while typing the label, until the admin edits slug.
                        if (!slugLocked.current.has(index)) next.slug = slugify(label);
                        if (!page.h1 || page.h1 === page.label) next.h1 = label;
                        patch(index, next);
                      }}
                    />
                    <TextControl
                      label="URL slug"
                      value={page.slug}
                      max={80}
                      hint="Lowercase letters, numbers, hyphens. Becomes /homes/…"
                      error={errors[`pages.${index}.slug`]}
                      onChange={(slug) => {
                        const cleaned = slugify(slug);
                        if (cleaned) slugLocked.current.add(index);
                        else slugLocked.current.delete(index);
                        patch(index, { slug: cleaned });
                      }}
                    />
                    <TextControl
                      label="Page title (H1)"
                      value={page.h1}
                      max={100}
                      error={errors[`pages.${index}.h1`]}
                      onChange={(h1) => patch(index, { h1 })}
                    />
                    <label className="block text-caption text-ink-muted">
                      Group
                      <select
                        className="mt-1 block h-10 w-full rounded-control border border-line bg-surface px-3 text-small text-ink"
                        value={page.group}
                        onChange={(event) => patch(index, { group: event.target.value as CuratedGroup })}
                      >
                        {CURATED_GROUPS.map((group) => (
                          <option key={group} value={group}>
                            {group}
                          </option>
                        ))}
                      </select>
                      {errors[`pages.${index}.group`] ? (
                        <span className="mt-1 block text-red-700">{errors[`pages.${index}.group`]}</span>
                      ) : null}
                    </label>
                    <div className="sm:col-span-2">
                      <TextControl
                        label="Description"
                        value={page.description}
                        max={240}
                        multiline
                        error={errors[`pages.${index}.description`]}
                        onChange={(description) => patch(index, { description })}
                      />
                    </div>

                    <div className="sm:col-span-2 border-t border-line pt-4">
                      <p className="text-small font-medium text-ink">Search definition</p>
                      <p className="mt-1 text-caption text-ink-muted">
                        Pin specific MLS® numbers, or leave pins empty and use the same filters as the
                        listings page. When pins are set, the public page shows those listings only.
                      </p>
                    </div>

                    <div className="sm:col-span-2">
                      <TextControl
                        label="Pinned MLS® numbers"
                        value={listingKeysText}
                        max={800}
                        multiline
                        hint={`Comma or newline separated, up to ${CURATED_LISTING_KEYS_MAX}. Empty = run the filter search.`}
                        error={errors[`pages.${index}.listingKeys`]}
                        onChange={(value) => {
                          const listingKeys = normalizeListingKeys(value);
                          patch(index, {
                            listingKeys: listingKeys.length ? listingKeys : undefined,
                          });
                        }}
                      />
                    </div>

                    <label className="block text-caption text-ink-muted">
                      Transaction
                      <select
                        className="mt-1 block h-10 w-full rounded-control border border-line bg-surface px-3 text-small text-ink"
                        value={page.query.transaction ?? ""}
                        onChange={(event) =>
                          patchQuery(index, {
                            transaction: (event.target.value || undefined) as ListingQuery["transaction"],
                          })
                        }
                      >
                        <option value="">Sale (default)</option>
                        <option value="sale">Sale</option>
                        <option value="rent">Rent</option>
                      </select>
                    </label>
                    <label className="block text-caption text-ink-muted">
                      Property type
                      <select
                        className="mt-1 block h-10 w-full rounded-control border border-line bg-surface px-3 text-small text-ink"
                        value={page.query.type ?? ""}
                        onChange={(event) =>
                          patchQuery(index, { type: event.target.value || undefined })
                        }
                      >
                        <option value="">Any</option>
                        {SEARCH_PROPERTY_TYPES.map((type) => (
                          <option key={type} value={type}>
                            {type}
                          </option>
                        ))}
                      </select>
                    </label>

                    <div className="space-y-1.5 sm:col-span-2">
                      <span className="block text-caption text-ink-muted">Listing status</span>
                      <div className="flex flex-wrap gap-2">
                        <ChipToggle
                          active={!page.query.status}
                          onClick={() => patchQuery(index, { status: undefined })}
                        >
                          All
                        </ChipToggle>
                        {STATUS_TABS.map((tab) => (
                          <ChipToggle
                            key={tab.param}
                            active={(page.query.status ?? "").toLowerCase() === tab.param.toLowerCase()}
                            onClick={() =>
                              patchQuery(index, {
                                status:
                                  (page.query.status ?? "").toLowerCase() === tab.param.toLowerCase()
                                    ? undefined
                                    : tab.param,
                              })
                            }
                          >
                            {isRent && tab.group === "active"
                              ? "For Lease"
                              : isRent && tab.group === "sold"
                                ? "Leased"
                                : tab.label}
                          </ChipToggle>
                        ))}
                      </div>
                    </div>

                    <TextControl
                      label={isRent ? "Min rent / month" : "Min price"}
                      value={page.query.priceMin != null ? String(page.query.priceMin) : ""}
                      max={12}
                      error={errors[`pages.${index}.query.priceMin`]}
                      onChange={(value) => patchQuery(index, { priceMin: positiveOrUndefined(value) })}
                    />
                    <TextControl
                      label={isRent ? "Max rent / month" : "Max price"}
                      value={page.query.priceMax != null ? String(page.query.priceMax) : ""}
                      max={12}
                      error={errors[`pages.${index}.query.priceMax`]}
                      onChange={(value) => patchQuery(index, { priceMax: positiveOrUndefined(value) })}
                    />
                    <TextControl
                      label="City"
                      value={page.query.city ?? ""}
                      max={80}
                      error={errors[`pages.${index}.query.city`]}
                      onChange={(city) => patchQuery(index, { city: city.trim() || undefined })}
                    />
                    <TextControl
                      label="Postal code"
                      value={formatCuratedPostal(page.query.postalCodes)}
                      max={120}
                      hint="L7A or L7A 3K9 — separate several with commas"
                      error={errors[`pages.${index}.query.postalCodes`]}
                      onChange={(value) => {
                        const { codes } = parsePostalList(value);
                        patchQuery(index, { postalCodes: codes.length ? codes : undefined });
                      }}
                    />

                    <ChipField
                      label="Bedrooms"
                      value={page.query.bedsMin != null ? String(page.query.bedsMin) : ""}
                      options={BED_OPTIONS}
                      suffix="+"
                      onChange={(beds) =>
                        patchQuery(index, { bedsMin: beds ? Number(beds) : undefined })
                      }
                    />
                    <ChipField
                      label="Bathrooms"
                      value={page.query.bathsMin != null ? String(page.query.bathsMin) : ""}
                      options={BATH_OPTIONS}
                      suffix="+"
                      onChange={(baths) =>
                        patchQuery(index, { bathsMin: baths ? Number(baths) : undefined })
                      }
                    />

                    <TextControl
                      label="Min sq ft"
                      value={page.query.sqftMin != null ? String(page.query.sqftMin) : ""}
                      max={8}
                      error={errors[`pages.${index}.query.sqftMin`]}
                      onChange={(value) => patchQuery(index, { sqftMin: positiveOrUndefined(value) })}
                    />
                    <TextControl
                      label="Max sq ft"
                      value={page.query.sqftMax != null ? String(page.query.sqftMax) : ""}
                      max={8}
                      error={errors[`pages.${index}.query.sqftMax`]}
                      onChange={(value) => patchQuery(index, { sqftMax: positiveOrUndefined(value) })}
                    />

                    <ChipField
                      label="Garages"
                      value={page.query.garagesMin != null ? String(page.query.garagesMin) : ""}
                      options={GARAGE_OPTIONS}
                      suffix="+"
                      onChange={(garages) =>
                        patchQuery(index, { garagesMin: garages ? Number(garages) : undefined })
                      }
                    />
                    <ChipField
                      label="Floors (min)"
                      value={page.query.storiesMin != null ? String(page.query.storiesMin) : ""}
                      options={FLOOR_OPTIONS}
                      suffix="+"
                      onChange={(floors) =>
                        patchQuery(index, { storiesMin: floors ? Number(floors) : undefined })
                      }
                    />

                    <div className="space-y-1.5 sm:col-span-2">
                      <span className="block text-caption text-ink-muted">Basement</span>
                      <div className="flex flex-wrap gap-2">
                        {BASEMENT_OPTIONS.map((option) => (
                          <ChipToggle
                            key={option.value || "any"}
                            active={(page.query.basement ?? "") === option.value}
                            onClick={() =>
                              patchQuery(index, {
                                basement: option.value
                                  ? (option.value as NonNullable<ListingQuery["basement"]>)
                                  : undefined,
                              })
                            }
                          >
                            {option.label}
                          </ChipToggle>
                        ))}
                      </div>
                      {errors[`pages.${index}.query.basement`] ? (
                        <span className="block text-red-700">{errors[`pages.${index}.query.basement`]}</span>
                      ) : null}
                    </div>

                    <div className="space-y-1.5 sm:col-span-2">
                      <span className="block text-caption text-ink-muted">Property age</span>
                      <div className="flex flex-wrap gap-2">
                        <ChipToggle
                          active={!page.query.yearBuiltMin}
                          onClick={() => patchQuery(index, { yearBuiltMin: undefined })}
                        >
                          Any
                        </ChipToggle>
                        {YEAR_BUILT_MIN_OPTIONS.map((year) => (
                          <ChipToggle
                            key={year}
                            active={page.query.yearBuiltMin === year}
                            onClick={() =>
                              patchQuery(index, {
                                yearBuiltMin: page.query.yearBuiltMin === year ? undefined : year,
                              })
                            }
                          >
                            {year}+
                          </ChipToggle>
                        ))}
                      </div>
                    </div>

                    <ChipField
                      label="Days on market"
                      value={page.query.domMax != null ? String(page.query.domMax) : ""}
                      options={DOM_OPTIONS}
                      suffix=" or fewer"
                      onChange={(domMax) =>
                        patchQuery(index, { domMax: domMax ? Number(domMax) : undefined })
                      }
                    />
                    <div className="space-y-1.5">
                      <span className="block text-caption text-ink-muted">Family room</span>
                      <div className="flex flex-wrap gap-2">
                        <ChipToggle
                          active={!page.query.familyRoom}
                          onClick={() => patchQuery(index, { familyRoom: undefined })}
                        >
                          Any
                        </ChipToggle>
                        <ChipToggle
                          active={page.query.familyRoom === true}
                          onClick={() =>
                            patchQuery(index, {
                              familyRoom: page.query.familyRoom ? undefined : true,
                            })
                          }
                        >
                          Has family room
                        </ChipToggle>
                      </div>
                    </div>

                    <ChipField
                      label="Number of kitchens"
                      value={page.query.kitchensMin != null ? String(page.query.kitchensMin) : ""}
                      options={KITCHEN_OPTIONS}
                      suffix="+"
                      onChange={(kitchens) =>
                        patchQuery(index, { kitchensMin: kitchens ? Number(kitchens) : undefined })
                      }
                    />
                    <ChipField
                      label="Most floors"
                      value={page.query.storiesMax != null ? String(page.query.storiesMax) : ""}
                      options={FLOOR_OPTIONS}
                      onChange={(floorsMax) =>
                        patchQuery(index, { storiesMax: floorsMax ? Number(floorsMax) : undefined })
                      }
                    />

                    <TextControl
                      label="Built in or before"
                      value={page.query.yearBuiltMax != null ? String(page.query.yearBuiltMax) : ""}
                      max={4}
                      hint="Few listings publish a year built."
                      error={errors[`pages.${index}.query.yearBuiltMax`]}
                      onChange={(value) =>
                        patchQuery(index, { yearBuiltMax: positiveOrUndefined(value) })
                      }
                    />
                    <label className="block text-caption text-ink-muted">
                      Listed since
                      <input
                        type="date"
                        className="mt-1 block h-10 w-full rounded-control border border-line bg-surface px-3 text-small text-ink"
                        value={page.query.listedSince ?? ""}
                        onChange={(event) =>
                          patchQuery(index, {
                            listedSince: event.target.value || undefined,
                          })
                        }
                      />
                      {errors[`pages.${index}.query.listedSince`] ? (
                        <span className="mt-1 block text-red-700">
                          {errors[`pages.${index}.query.listedSince`]}
                        </span>
                      ) : null}
                    </label>

                    <TextControl
                      label="Min maintenance fee / month"
                      value={page.query.feeMin != null ? String(page.query.feeMin) : ""}
                      max={8}
                      error={errors[`pages.${index}.query.feeMin`]}
                      onChange={(value) => patchQuery(index, { feeMin: positiveOrUndefined(value) })}
                    />
                    <TextControl
                      label="Max maintenance fee / month"
                      value={page.query.feeMax != null ? String(page.query.feeMax) : ""}
                      max={8}
                      error={errors[`pages.${index}.query.feeMax`]}
                      onChange={(value) => patchQuery(index, { feeMax: positiveOrUndefined(value) })}
                    />

                    <label className="block text-caption text-ink-muted">
                      Building type
                      <select
                        className="mt-1 block h-10 w-full rounded-control border border-line bg-surface px-3 text-small text-ink"
                        value={page.query.buildingType ?? ""}
                        onChange={(event) =>
                          patchQuery(index, { buildingType: event.target.value || undefined })
                        }
                      >
                        <option value="">Any</option>
                        {BUILDING_OPTIONS.map((option) => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ))}
                      </select>
                      {errors[`pages.${index}.query.buildingType`] ? (
                        <span className="mt-1 block text-red-700">
                          {errors[`pages.${index}.query.buildingType`]}
                        </span>
                      ) : null}
                    </label>
                    <label className="block text-caption text-ink-muted">
                      Ownership / title
                      <select
                        className="mt-1 block h-10 w-full rounded-control border border-line bg-surface px-3 text-small text-ink"
                        value={page.query.ownership ?? ""}
                        onChange={(event) =>
                          patchQuery(index, { ownership: event.target.value || undefined })
                        }
                      >
                        <option value="">Any</option>
                        {OWNERSHIP_OPTIONS.map((option) => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ))}
                      </select>
                      {errors[`pages.${index}.query.ownership`] ? (
                        <span className="mt-1 block text-red-700">
                          {errors[`pages.${index}.query.ownership`]}
                        </span>
                      ) : null}
                    </label>

                    <div className="space-y-1.5 sm:col-span-2">
                      <span className="block text-caption text-ink-muted">Open house</span>
                      <div className="flex flex-wrap gap-2">
                        <ChipToggle
                          active={page.query.openHouse === true}
                          onClick={() =>
                            patchQuery(index, {
                              openHouse: page.query.openHouse ? undefined : true,
                            })
                          }
                        >
                          Has an upcoming open house
                        </ChipToggle>
                      </div>
                    </div>

                    <div className="sm:col-span-2">
                      <TextControl
                        label="Description keywords"
                        value={keywordsText}
                        max={600}
                        multiline
                        hint="Comma-separated phrases matched in listing remarks (OR). Leave blank for filter-only searches."
                        error={errors[`pages.${index}.query.keywords`]}
                        onChange={(value) => {
                          const keywords = value
                            .split(",")
                            .map((part) => part.trim())
                            .filter(Boolean);
                          patchQuery(index, { keywords: keywords.length ? keywords : undefined });
                        }}
                      />
                    </div>

                    <label className="flex items-center gap-2 text-small text-ink sm:col-span-2">
                      <input
                        type="checkbox"
                        checked={page.enabled !== false}
                        onChange={(event) => patch(index, { enabled: event.target.checked })}
                      />
                      Show on the public site
                    </label>
                    {page.slug ? (
                      <p className="text-caption text-ink-muted sm:col-span-2">
                        Public URL after publish:{" "}
                        <a className="text-navy underline" href={curatedPath(page)} target="_blank" rel="noreferrer">
                          {curatedPath(page)}
                        </a>
                      </p>
                    ) : null}
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function ChipField({
  label,
  value,
  options,
  suffix = "",
  onChange,
}: {
  label: string;
  value: string;
  options: readonly number[];
  suffix?: string;
  onChange: (next: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <span className="block text-caption text-ink-muted">{label}</span>
      <div className="flex flex-wrap gap-2">
        <ChipToggle active={!value} onClick={() => onChange("")}>
          Any
        </ChipToggle>
        {options.map((option) => (
          <ChipToggle
            key={option}
            active={value === String(option)}
            onClick={() => onChange(value === String(option) ? "" : String(option))}
          >
            {option}
            {suffix}
          </ChipToggle>
        ))}
      </div>
    </div>
  );
}
