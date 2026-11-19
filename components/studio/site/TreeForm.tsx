"use client";

import { Switch } from "@/components/ui/Switch";
import { ImageControl, TextControl } from "@/components/studio/site/fields";
import type { FieldErrors } from "@/lib/site/validate";

const LABELS: Record<string, string> = {
  eyebrow: "Small label above the heading",
  title: "Heading",
  description: "Description",
  caption: "Caption",
  imageUrl: "Image",
  imageAlt: "Image description",
  focalX: "Photo focus",
  scrim: "Dark overlay",
  accentLine: "Gold accent line",
  lines: "Heading lines",
  tryPrompts: "AI “Try” prompts",
  intents: "Buy / Rent / Sold labels",
  propertyTypes: "Property type dropdown",
  salePrices: "Sale price ranges",
  rentPrices: "Rent price ranges",
  bedOptions: "Bedroom dropdown",
  bathOptions: "Bathroom dropdown",
  actionLabel: "Button label",
  actionHref: "Button link",
  useAutomaticDescription: "Let the site describe the rail from the listings it actually shows",
  whatsapp: "WhatsApp number",
  whatsappMessage: "WhatsApp message",
  ctaLabel: "Button label",
  ctaHref: "Button link",
  bannerEyebrow: "Banner eyebrow",
  bannerHeading: "Banner heading",
  bannerLabel: "Banner button",
  bannerHref: "Banner link",
  blurb: "Short description",
  newsletterTitle: "Newsletter heading",
  newsletterDescription: "Newsletter description",
  insightsLabel: "Insights link label",
  insightsHref: "Insights link",
  primaryLabel: "Primary button",
  primaryHref: "Primary link",
  secondaryLabel: "Secondary button",
  secondaryHref: "Secondary link",
  shareImageUrl: "Share image",
  shareImageAlt: "Share image description",
  display_order: "Position",
  value: "Value (do not invent new codes)",
};

const HINTS: Record<string, string> = {
  href: "A page on this site, such as /listings, or a full https link.",
  actionHref: "A page on this site, such as /listings, or a full https link.",
  ctaHref: "A page on this site, such as /home-evaluation.",
  whatsapp: "Digits with the country code. Example: 14168214200.",
  focalX: "0 keeps the left side of the photo. 100 keeps the right side.",
  scrim: "A higher number darkens the photo so the heading stays easy to read.",
  imageAlt: "Say what is in the photo. Required.",
  lines: "Each line is one row of the heading. Keep it short.",
  tryPrompts: "Example searches shown under the AI box. Visitors can tap one to run it.",
  intents: "Only change the Label visitors see. Value must stay buy, rent, or sold.",
  propertyTypes: "Label is free text. Value must be Detached, Semi-Detached, Townhome, Condo, or Luxury.",
  salePrices: "Label is free text. Value is min-max dollars, e.g. 500000-800000, or 2000000- for open-ended.",
  rentPrices: "Same as sale prices, but monthly rent amounts.",
  bedOptions: "Label is free text. Value is a number (1–20) or blank for Any.",
  bathOptions: "Label is free text. Value is a number (1–20) or blank for Any.",
  value: "This drives the listings URL. Wrong values are rejected on save.",
};

const LIST_NOUN: Record<string, string> = {
  lines: "Heading line",
  tryPrompts: "Try prompt",
  links: "Link",
  items: "Card",
  columns: "Column",
  steps: "Step",
  socials: "Social link",
  bullets: "Point",
  cards: "Card",
  alerts: "Alert",
  intents: "Intent",
  propertyTypes: "Property type",
  salePrices: "Sale price",
  rentPrices: "Rent price",
  bedOptions: "Bedroom option",
  bathOptions: "Bathroom option",
};

const MAX: Record<string, number> = {
  eyebrow: 40,
  title: 80,
  description: 280,
  caption: 160,
  label: 40,
  text: 90,
  href: 300,
  blurb: 280,
  lines: 22,
  tryPrompts: 90,
  name: 60,
  tag: 16,
  imageAlt: 140,
  shareImageAlt: 140,
  whatsappMessage: 180,
  newsletterTitle: 70,
  newsletterDescription: 160,
};

const ICONS: Record<string, string[]> = {
  quick: ["buy", "rent", "precon", "sell"],
  type: ["detached", "condo", "townhome", "luxury", "semi", "rental"],
  advantage: ["mls", "precon", "local", "guidance"],
};

function labelFor(key: string): string {
  if (LABELS[key]) return LABELS[key];
  return key.replace(/([A-Z])/g, " $1").replace(/^./, (char) => char.toUpperCase());
}

function maxFor(key: string): number {
  return MAX[key] ?? (key.endsWith("Href") || key.endsWith("Url") ? 300 : 180);
}

export function TreeForm({
  value,
  path,
  errors,
  onChange,
}: {
  value: unknown;
  path: string;
  errors: FieldErrors;
  onChange: (next: unknown) => void;
}) {
  if (Array.isArray(value)) {
    return (
      <ListEditor value={value} path={path} errors={errors} onChange={onChange} />
    );
  }
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    // Stable field order so hero prompts stay near the heading fields.
    const preferred = [
      "imageUrl",
      "imageAlt",
      "focalX",
      "scrim",
      "eyebrow",
      "lines",
      "accentLine",
      "description",
      "tryPrompts",
      "intents",
      "propertyTypes",
      "salePrices",
      "rentPrices",
      "bedOptions",
      "bathOptions",
      "title",
      "caption",
      "items",
      "actionLabel",
      "actionHref",
    ];
    const keys = [
      ...preferred.filter((key) => key in record && key !== "id"),
      ...Object.keys(record).filter((key) => key !== "id" && !preferred.includes(key)),
    ];
    return (
      <div className="space-y-4">
        {keys.map((key) => {
          const child = path ? `${path}.${key}` : key;
          if (key === "imageUrl" && typeof record.imageAlt === "string") {
            return (
              <ImageControl
                key={key}
                label={labelFor(key)}
                url={String(record.imageUrl ?? "")}
                alt={String(record.imageAlt ?? "")}
                role={path.endsWith("hero") ? "hero" : "section"}
                error={errors[child]}
                altError={errors[`${path}.imageAlt`]}
                onChange={(next) => onChange({ ...record, imageUrl: next.url, imageAlt: next.alt })}
              />
            );
          }
          if (key === "imageAlt" || key === "shareImageAlt") return null;
          if (key === "shareImageUrl") {
            return (
              <ImageControl
                key={key}
                label="Share image"
                url={String(record.shareImageUrl ?? "")}
                alt={String(record.shareImageAlt ?? "")}
                role="section"
                error={errors.shareImageUrl}
                altError={errors.shareImageAlt}
                onChange={(next) => onChange({ ...record, shareImageUrl: next.url, shareImageAlt: next.alt })}
              />
            );
          }
          return (
            <FieldEditor
              key={key}
              name={key}
              value={record[key]}
              path={child}
              errors={errors}
              onChange={(next) => onChange({ ...record, [key]: next })}
            />
          );
        })}
      </div>
    );
  }
  return null;
}

function FieldEditor({
  name,
  value,
  path,
  errors,
  onChange,
}: {
  name: string;
  value: unknown;
  path: string;
  errors: FieldErrors;
  onChange: (next: unknown) => void;
}) {
  if (typeof value === "boolean") {
    return (
      <label className="flex items-center justify-between gap-4 rounded-control border border-line bg-surface px-4 py-3">
        <span className="text-small text-ink">{labelFor(name)}</span>
        <Switch aria-label={labelFor(name)} checked={value} onCheckedChange={onChange} />
      </label>
    );
  }
  if (typeof value === "number") {
    if (name === "focalX" || name === "scrim") {
      const min = name === "scrim" ? 40 : 0;
      const max = name === "scrim" ? 70 : 100;
      return (
        <label className="block text-small font-medium text-ink">
          {labelFor(name)} · {value}
          <input
            type="range"
            min={min}
            max={max}
            value={value}
            onChange={(event) => onChange(Number(event.target.value))}
            className="mt-3 w-full"
          />
          {HINTS[name] && <span className="mt-1 block font-normal text-caption text-ink-muted">{HINTS[name]}</span>}
          {errors[path] && <span className="mt-1 block text-caption text-negative">{errors[path]}</span>}
        </label>
      );
    }
    return (
      <TextControl
        label={labelFor(name)}
        value={String(value)}
        max={8}
        error={errors[path]}
        onChange={(next) => onChange(next === "" ? 0 : Number(next))}
      />
    );
  }
  if (typeof value === "string") {
    if (name === "icon") {
      const options = Object.values(ICONS).find((set) => set.includes(value)) ?? ICONS.quick;
      return (
        <label className="block text-small text-ink">
          Icon
          <select
            className="mt-1.5 h-11 w-full rounded-control border border-line bg-surface px-3 text-small"
            value={value}
            onChange={(event) => onChange(event.target.value)}
          >
            {options.map((option) => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
        </label>
      );
    }
    if (name === "network") {
      return (
        <label className="block text-small text-ink">
          Network
          <select
            className="mt-1.5 h-11 w-full rounded-control border border-line bg-surface px-3 text-small"
            value={value}
            onChange={(event) => onChange(event.target.value)}
          >
            <option value="facebook">Facebook</option>
            <option value="instagram">Instagram</option>
            <option value="youtube">YouTube</option>
            <option value="x">X</option>
            <option value="linkedin">LinkedIn</option>
          </select>
        </label>
      );
    }
    const multiline = name === "description" || name === "blurb" || name === "title" || name === "whatsappMessage";
    return (
      <TextControl
        label={labelFor(name)}
        value={value}
        max={name === "title" && value.includes("\n") ? 80 : maxFor(name)}
        error={errors[path]}
        multiline={multiline}
        hint={HINTS[name] || (name === "title" ? "One or two short lines." : undefined)}
        onChange={onChange}
      />
    );
  }
  return <TreeForm value={value} path={path} errors={errors} onChange={onChange} />;
}

function ListEditor({
  value,
  path,
  errors,
  onChange,
}: {
  value: unknown[];
  path: string;
  errors: FieldErrors;
  onChange: (next: unknown[]) => void;
}) {
  return (
    <div className="space-y-3">
      {errors[path] && <p className="text-caption text-negative">{errors[path]}</p>}
      {value.map((item, index) => (
        <div key={index} className="rounded-surface border border-line bg-surface-alt p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <p className="text-small font-semibold text-ink">{nounFor(path)} {index + 1}</p>
            <div className="flex gap-1">
              <button type="button" className="rounded-control px-2.5 py-1.5 text-small text-navy hover:bg-surface disabled:opacity-30" disabled={index === 0} onClick={() => move(value, index, -1, onChange)}>Move up</button>
              <button type="button" className="rounded-control px-2.5 py-1.5 text-small text-navy hover:bg-surface disabled:opacity-30" disabled={index === value.length - 1} onClick={() => move(value, index, 1, onChange)}>Move down</button>
              <button type="button" className="rounded-control px-2.5 py-1.5 text-small text-negative hover:bg-surface" onClick={() => onChange(value.filter((_, itemIndex) => itemIndex !== index))}>Remove</button>
            </div>
          </div>
          {typeof item === "string" ? (
            <TextControl
              label={
                path.endsWith("lines")
                  ? "Line"
                  : path.endsWith("tryPrompts")
                    ? "Prompt"
                    : "Text"
              }
              value={item}
              max={
                path.endsWith("lines")
                  ? 22
                  : path.endsWith("tryPrompts")
                    ? 90
                    : maxFor("text")
              }
              error={errors[`${path}.${index}`]}
              onChange={(next) => onChange(value.map((entry, itemIndex) => (itemIndex === index ? next : entry)))}
            />
          ) : (
            <TreeForm
              value={item}
              path={`${path}.${index}`}
              errors={errors}
              onChange={(next) => onChange(value.map((entry, itemIndex) => (itemIndex === index ? next : entry)))}
            />
          )}
        </div>
      ))}
      <button
        type="button"
        className="rounded-control border border-dashed border-line px-4 py-3 text-small font-medium text-navy hover:border-navy hover:bg-surface"
        onClick={() => onChange([...value, blankLike(value[0])])}
      >
        Add {nounFor(path).toLowerCase()}
      </button>
    </div>
  );
}

function nounFor(path: string) {
  const key = path.split(".").pop() || "";
  return LIST_NOUN[key] || "Item";
}

function move(items: unknown[], index: number, direction: -1 | 1, onChange: (next: unknown[]) => void) {
  const next = items.slice();
  const target = index + direction;
  [next[index], next[target]] = [next[target], next[index]];
  onChange(next);
}

function blankLike(sample: unknown): unknown {
  if (typeof sample === "string") return "";
  if (Array.isArray(sample)) return [];
  if (sample && typeof sample === "object") {
    return Object.fromEntries(Object.entries(sample).map(([key, value]) => [key, blankLike(value)]));
  }
  if (typeof sample === "number") return 0;
  if (typeof sample === "boolean") return false;
  return "";
}
