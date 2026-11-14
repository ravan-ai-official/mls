/**
 * Client-side limits for the site editor. The Django serializer enforces the
 * same rules again on save. Paths match the API field errors.
 */

import {
  CURATED_LISTING_KEYS_MAX,
  normalizeListingKeys,
} from "@/lib/seo/curatedPages";
import {
  BASEMENT_VALUES,
  BUILDING_OPTIONS,
  OWNERSHIP_OPTIONS,
} from "@/lib/search/listingFilterOptions";
import {
  isHeroCountValue,
  isHeroIntentValue,
  isHeroPriceValue,
  isHeroPropertyTypeValue,
} from "@/lib/site/heroFilters";
import { SECTION_IDS, type HomepageDocument, type SectionId } from "@/lib/site/types";
import { parsePostalList } from "@/lib/utils/postal";

export type FieldErrors = Record<string, string>;

const QUICK = new Set(["buy", "rent", "precon", "sell"]);
const TYPES = new Set(["detached", "condo", "townhome", "luxury", "openHouse", "rental"]);
const ADVANTAGE = new Set(["mls", "precon", "local", "guidance"]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function text(errors: FieldErrors, path: string, value: unknown, max: number, required = true): string {
  if (typeof value !== "string") {
    errors[path] = "Enter text.";
    return "";
  }
  const cleaned = value.includes("\n") ? value.trim() : value.trim().replace(/\s+/g, " ");
  if (required && !cleaned) errors[path] = "This field is required.";
  else if (cleaned.length > max) errors[path] = `Keep this to ${max} characters or fewer so the layout holds.`;
  return cleaned;
}

function link(errors: FieldErrors, path: string, value: unknown, allowEmpty = false): void {
  if (typeof value !== "string") {
    errors[path] = "Enter a link.";
    return;
  }
  const href = value.trim();
  if (!href && allowEmpty) return;
  if (!href) {
    errors[path] = "Enter a link.";
    return;
  }
  if (href.startsWith("/") && !href.startsWith("//") && !href.includes(" ") && !href.includes("\\")) return;
  try {
    const url = new URL(href);
    if (url.protocol === "https:") return;
  } catch {
    /* fall through */
  }
  errors[path] = "Use a site path starting with / or a full https link.";
}

function count(errors: FieldErrors, path: string, value: unknown, min: number, max: number): unknown[] {
  if (!Array.isArray(value) || value.length < min || value.length > max) {
    errors[path] = `Use between ${min} and ${max} items so the row still fits.`;
    return Array.isArray(value) ? value : [];
  }
  return value;
}

function range(errors: FieldErrors, path: string, value: unknown, min: number, max: number): void {
  if (typeof value !== "number" || value < min || value > max) {
    errors[path] = `Use a number from ${min} to ${max}.`;
  }
}

export function validateHomepage(document: HomepageDocument): FieldErrors {
  const errors: FieldErrors = {};
  const seen = new Set<string>();
  for (const section of document.sections) {
    if (!SECTION_IDS.includes(section.id)) {
      errors.sections = "Unknown section.";
      continue;
    }
    if (seen.has(section.id)) errors[`sections.${section.id}`] = "This section is listed twice.";
    seen.add(section.id);
    if (section.id === "hero" && section.visible === false) {
      errors["sections.hero.visible"] = "The hero stays on the page. Hide a section below it instead.";
    }
    validateSection(section.id, section.content, errors);
  }
  if (SECTION_IDS.some((id) => !seen.has(id))) {
    errors.sections = "Every homepage section must be included, even hidden ones.";
  }
  return errors;
}

function validateSection(id: SectionId, content: Record<string, unknown>, errors: FieldErrors): void {
  const path = `sections.${id}`;
  const rail = (withDescription = false) => {
    text(errors, `${path}.eyebrow`, content.eyebrow, 40);
    text(errors, `${path}.title`, content.title, 60);
    text(errors, `${path}.actionLabel`, content.actionLabel, 32);
    link(errors, `${path}.actionHref`, content.actionHref);
    if (withDescription) text(errors, `${path}.description`, content.description, 180);
  };

  if (id === "hero") {
    link(errors, `${path}.imageUrl`, content.imageUrl);
    text(errors, `${path}.imageAlt`, content.imageAlt, 140);
    range(errors, `${path}.focalX`, content.focalX, 0, 100);
    range(errors, `${path}.scrim`, content.scrim, 40, 70);
    text(errors, `${path}.eyebrow`, content.eyebrow, 40);
    text(errors, `${path}.description`, content.description, 220);
    const lines = count(errors, `${path}.lines`, content.lines, 1, 4);
    lines.slice(0, 4).forEach((line, index) => text(errors, `${path}.lines.${index}`, line, 22));
    const accent = content.accentLine;
    if (typeof accent !== "number" || accent < -1 || accent >= Math.max(lines.length, 1)) {
      errors[`${path}.accentLine`] = "Pick one heading line for the gold accent, or none.";
    }
    // Optional so older saved heroes without prompts still validate; the
    // homepage falls back to the defaults when the list is missing.
    if (content.tryPrompts !== undefined) {
      const prompts = count(errors, `${path}.tryPrompts`, content.tryPrompts, 1, 8);
      prompts.slice(0, 8).forEach((prompt, index) =>
        text(errors, `${path}.tryPrompts.${index}`, prompt, 90),
      );
    }
    // Filter dropdowns under the Filters tab — values are locked to shapes the
    // /listings URL parser understands so a bad edit cannot crash search.
    if (content.intents !== undefined) {
      const intents = count(errors, `${path}.intents`, content.intents, 1, 3);
      const seen = new Set<string>();
      intents.forEach((item, index) => {
        const row = isRecord(item) ? item : {};
        const value = typeof row.value === "string" ? row.value.trim() : "";
        text(errors, `${path}.intents.${index}.label`, row.label, 16);
        if (!isHeroIntentValue(value)) {
          errors[`${path}.intents.${index}.value`] = "Value must be buy, rent, or sold.";
        } else if (seen.has(value)) {
          errors[`${path}.intents.${index}.value`] = "Each intent can only appear once.";
        } else {
          seen.add(value);
        }
      });
    }
    if (content.propertyTypes !== undefined) {
      const types = count(errors, `${path}.propertyTypes`, content.propertyTypes, 1, 8);
      types.forEach((item, index) => {
        const row = isRecord(item) ? item : {};
        text(errors, `${path}.propertyTypes.${index}.label`, row.label, 24);
        const value = typeof row.value === "string" ? row.value.trim() : "";
        if (!isHeroPropertyTypeValue(value) || !value) {
          errors[`${path}.propertyTypes.${index}.value`] =
            "Use Detached, Semi-Detached, Townhome, Condo, or Luxury.";
        }
      });
    }
    for (const key of ["salePrices", "rentPrices"] as const) {
      if (content[key] === undefined) continue;
      const prices = count(errors, `${path}.${key}`, content[key], 1, 10);
      prices.forEach((item, index) => {
        const row = isRecord(item) ? item : {};
        text(errors, `${path}.${key}.${index}.label`, row.label, 28);
        const value = typeof row.value === "string" ? row.value.trim() : "";
        if (!isHeroPriceValue(value)) {
          errors[`${path}.${key}.${index}.value`] =
            "Use min-max like 500000-800000, open-ended like 2000000-, or leave blank for Any.";
        }
      });
    }
    for (const key of ["bedOptions", "bathOptions"] as const) {
      if (content[key] === undefined) continue;
      const options = count(errors, `${path}.${key}`, content[key], 1, 10);
      options.forEach((item, index) => {
        const row = isRecord(item) ? item : {};
        text(errors, `${path}.${key}.${index}.label`, row.label, 20);
        const value = typeof row.value === "string" ? row.value.trim() : "";
        if (!isHeroCountValue(value)) {
          errors[`${path}.${key}.${index}.value`] = "Use a whole number from 1 to 20, or leave blank for Any.";
        }
      });
    }
    return;
  }
  if (id === "quickActions") {
    const items = count(errors, `${path}.items`, content.items, 2, 6);
    items.forEach((item, index) => card(errors, `${path}.items.${index}`, item, QUICK));
    return;
  }
  if (id === "trendingCommunities" || id === "newPrecon" || id === "todaysNew") {
    rail();
    return;
  }
  if (id === "featuredListings" || id === "soldBelow") {
    rail(true);
    return;
  }
  if (id === "propertyTypes") {
    text(errors, `${path}.title`, content.title, 60);
    const items = count(errors, `${path}.items`, content.items, 2, 6);
    items.forEach((item, index) => {
      const row = isRecord(item) ? item : {};
      if (!TYPES.has(String(row.icon))) errors[`${path}.items.${index}.icon`] = "Choose one of the available icons.";
      text(errors, `${path}.items.${index}.label`, row.label, 24);
      link(errors, `${path}.items.${index}.href`, row.href);
    });
    return;
  }
  if (id === "highReturn") {
    rail(true);
    text(errors, `${path}.caption`, content.caption, 160);
    return;
  }
  if (id === "marketDeals") {
    text(errors, `${path}.eyebrow`, content.eyebrow, 40);
    text(errors, `${path}.title`, content.title, 60);
    text(errors, `${path}.caption`, content.caption, 160);
    return;
  }
  if (id === "schools") {
    text(errors, `${path}.eyebrow`, content.eyebrow, 40);
    text(errors, `${path}.title`, content.title, 60);
    text(errors, `${path}.description`, content.description, 160);
    const items = count(errors, `${path}.items`, content.items, 1, 6);
    items.forEach((item, index) => {
      const row = isRecord(item) ? item : {};
      const base = `${path}.items.${index}`;
      text(errors, `${base}.name`, row.name, 60);
      text(errors, `${base}.community`, row.community, 40);
      range(errors, `${base}.rating`, row.rating, 0, 10);
      range(errors, `${base}.listings`, row.listings, 0, 9999);
      link(errors, `${base}.imageUrl`, row.imageUrl);
      text(errors, `${base}.imageAlt`, row.imageAlt, 140);
      link(errors, `${base}.href`, row.href);
    });
    return;
  }
  if (id === "incentives") {
    text(errors, `${path}.eyebrow`, content.eyebrow, 40);
    text(errors, `${path}.title`, content.title, 60);
    text(errors, `${path}.description`, content.description, 220);
    return;
  }
  if (id === "marketIntelligence" || id === "partners") {
    text(errors, `${path}.eyebrow`, content.eyebrow, 40);
    const title = typeof content.title === "string" ? content.title.trim() : "";
    if (!title) errors[`${path}.title`] = "This field is required.";
    else if (title.split("\n").length > 2 || title.length > 80) {
      errors[`${path}.title`] = "Use at most 2 lines and 80 characters.";
    }
    if (id === "partners") text(errors, `${path}.description`, content.description, 220);
    return;
  }
  if (id === "neighbourAlerts") {
    text(errors, `${path}.eyebrow`, content.eyebrow, 40);
    const title = typeof content.title === "string" ? content.title.trim() : "";
    if (!title) errors[`${path}.title`] = "This field is required.";
    else if (title.split("\n").length > 2 || title.length > 80) errors[`${path}.title`] = "Use at most 2 lines and 80 characters.";
    text(errors, `${path}.description`, content.description, 280);
    const bullets = count(errors, `${path}.bullets`, content.bullets, 1, 6);
    bullets.forEach((bullet, index) => text(errors, `${path}.bullets.${index}`, bullet, 90));
    text(errors, `${path}.whatsappMessage`, content.whatsappMessage, 180);
    return;
  }
  if (id === "alertsCta") {
    text(errors, `${path}.eyebrow`, content.eyebrow, 40);
    text(errors, `${path}.title`, content.title, 40);
    text(errors, `${path}.description`, content.description, 220);
    const alerts = Array.isArray(content.alerts) ? content.alerts : [];
    const keys = alerts.map((item) => (isRecord(item) ? item.key : ""));
    if (keys.join() !== "newListings,priceChanges,statusUpdates") {
      errors[`${path}.alerts`] = "Keep the three alert types. You can edit their labels.";
    } else {
      alerts.forEach((item, index) => {
        const row = isRecord(item) ? item : {};
        text(errors, `${path}.alerts.${index}.label`, row.label, 28);
        text(errors, `${path}.alerts.${index}.description`, row.description, 80);
      });
    }
    return;
  }
  if (id === "thinkingOfSelling") {
    text(errors, `${path}.eyebrow`, content.eyebrow, 40);
    text(errors, `${path}.title`, content.title, 48);
    text(errors, `${path}.description`, content.description, 220);
    text(errors, `${path}.primaryLabel`, content.primaryLabel, 32);
    link(errors, `${path}.primaryHref`, content.primaryHref);
    text(errors, `${path}.secondaryLabel`, content.secondaryLabel, 32);
    link(errors, `${path}.secondaryHref`, content.secondaryHref);
    link(errors, `${path}.imageUrl`, content.imageUrl);
    text(errors, `${path}.imageAlt`, content.imageAlt, 140);
    return;
  }
  if (id === "whyHomeAtlas") {
    text(errors, `${path}.eyebrow`, content.eyebrow, 40);
    text(errors, `${path}.title`, content.title, 48);
    const items = count(errors, `${path}.items`, content.items, 2, 6);
    items.forEach((item, index) => {
      const row = isRecord(item) ? item : {};
      if (!ADVANTAGE.has(String(row.icon))) errors[`${path}.items.${index}.icon`] = "Choose one of the available icons.";
      text(errors, `${path}.items.${index}.title`, row.title, 40);
      text(errors, `${path}.items.${index}.description`, row.description, 140);
    });
    return;
  }
  if (id === "research") {
    text(errors, `${path}.eyebrow`, content.eyebrow, 40);
    text(errors, `${path}.title`, content.title, 48);
    text(errors, `${path}.description`, content.description, 160);
    const items = count(errors, `${path}.items`, content.items, 1, 4);
    items.forEach((item, index) => imageCard(errors, `${path}.items.${index}`, item));
    return;
  }
  if (id === "howItWorks") {
    text(errors, `${path}.eyebrow`, content.eyebrow, 40);
    text(errors, `${path}.title`, content.title, 40);
    text(errors, `${path}.description`, content.description, 220);
    text(errors, `${path}.whatsappMessage`, content.whatsappMessage, 180);
    text(errors, `${path}.insightsLabel`, content.insightsLabel, 40);
    link(errors, `${path}.insightsHref`, content.insightsHref);
    const steps = count(errors, `${path}.steps`, content.steps, 2, 4);
    steps.forEach((step, index) => {
      const row = isRecord(step) ? step : {};
      text(errors, `${path}.steps.${index}.title`, row.title, 70);
      text(errors, `${path}.steps.${index}.description`, row.description, 180);
    });
    return;
  }
  if (id === "dailyNews") {
    rail(true);
    text(errors, `${path}.newsletterTitle`, content.newsletterTitle, 70);
    text(errors, `${path}.newsletterDescription`, content.newsletterDescription, 160);
    return;
  }
  if (id === "resources") {
    text(errors, `${path}.eyebrow`, content.eyebrow, 40);
    text(errors, `${path}.title`, content.title, 48);
    text(errors, `${path}.actionLabel`, content.actionLabel, 32);
    link(errors, `${path}.actionHref`, content.actionHref);
    const items = count(errors, `${path}.items`, content.items, 1, 6);
    items.forEach((item, index) => {
      const row = isRecord(item) ? item : {};
      const base = `${path}.items.${index}`;
      text(errors, `${base}.tag`, row.tag, 16);
      text(errors, `${base}.title`, row.title, 48);
      text(errors, `${base}.description`, row.description, 140);
      link(errors, `${base}.href`, row.href);
    });
    return;
  }
  text(errors, `${path}.eyebrow`, content.eyebrow, 40);
  text(errors, `${path}.title`, content.title, 48);
}

function card(errors: FieldErrors, path: string, item: unknown, icons: Set<string>): void {
  const row = isRecord(item) ? item : {};
  if (!icons.has(String(row.icon))) errors[`${path}.icon`] = "Choose one of the available icons.";
  text(errors, `${path}.label`, row.label, 24);
  text(errors, `${path}.description`, row.description, 48);
  link(errors, `${path}.href`, row.href);
}

function imageCard(errors: FieldErrors, path: string, item: unknown): void {
  const row = isRecord(item) ? item : {};
  text(errors, `${path}.title`, row.title, 40);
  text(errors, `${path}.description`, row.description, 140);
  link(errors, `${path}.imageUrl`, row.imageUrl);
  text(errors, `${path}.imageAlt`, row.imageAlt, 140);
  link(errors, `${path}.href`, row.href);
}

export function validateChrome(document: unknown): FieldErrors {
  const errors: FieldErrors = {};
  if (!isRecord(document)) return { "": "The document must be an object." };
  const announcement = isRecord(document.announcement) ? document.announcement : {};
  const items = count(errors, "announcement.items", announcement.items, 1, 6);
  items.forEach((item, index) => {
    const row = isRecord(item) ? item : {};
    text(errors, `announcement.items.${index}.text`, row.text, 90);
    const label = typeof row.label === "string" ? row.label.trim() : "";
    const href = typeof row.href === "string" ? row.href.trim() : "";
    if (label.length > 28) errors[`announcement.items.${index}.label`] = "Keep this to 28 characters or fewer so the layout holds.";
    if (Boolean(label) !== Boolean(href)) {
      errors[`announcement.items.${index}`] = "A link needs both a label and an address, or leave both blank.";
    } else if (href) link(errors, `announcement.items.${index}.href`, href);
  });
  const nav = isRecord(document.nav) ? document.nav : {};
  const links = count(errors, "nav.links", nav.links, 2, 10);
  links.forEach((item, index) => pair(errors, `nav.links.${index}`, item, 24));
  text(errors, "nav.ctaLabel", nav.ctaLabel, 28);
  link(errors, "nav.ctaHref", nav.ctaHref);
  const footer = isRecord(document.footer) ? document.footer : {};
  text(errors, "footer.bannerEyebrow", footer.bannerEyebrow, 40);
  text(errors, "footer.bannerHeading", footer.bannerHeading, 80);
  text(errors, "footer.bannerLabel", footer.bannerLabel, 32);
  link(errors, "footer.bannerHref", footer.bannerHref);
  text(errors, "footer.blurb", footer.blurb, 280);
  const socials = Array.isArray(footer.socials) ? footer.socials : [];
  if (socials.length > 5) errors["footer.socials"] = "Use at most 5 social links.";
  socials.forEach((item, index) => {
    const row = isRecord(item) ? item : {};
    const href = typeof row.href === "string" ? row.href.trim() : "";
    if (href && !href.startsWith("https://")) errors[`footer.socials.${index}.href`] = "Social links must start with https://.";
  });
  const columns = count(errors, "footer.columns", footer.columns, 1, 4);
  columns.forEach((column, index) => {
    const row = isRecord(column) ? column : {};
    text(errors, `footer.columns.${index}.heading`, row.heading, 24);
    const columnLinks = count(errors, `footer.columns.${index}.links`, row.links, 1, 8);
    columnLinks.forEach((item, linkIndex) => pair(errors, `footer.columns.${index}.links.${linkIndex}`, item, 40));
  });
  const contact = isRecord(document.contact) ? document.contact : {};
  const digits = String(contact.whatsapp ?? "").replace(/\D/g, "");
  if (digits.length < 10 || digits.length > 15) {
    errors["contact.whatsapp"] = "Enter a WhatsApp number with country code, digits only.";
  }
  optionalText(errors, "contact.name", contact.name, 80);
  optionalText(errors, "contact.title", contact.title, 80);
  optionalText(errors, "contact.address", contact.address, 160);
  if (typeof contact.email === "string" && contact.email.trim()) {
    const email = contact.email.trim();
    if (email.length > 120 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errors["contact.email"] = "Enter a valid email address.";
    }
  }
  if (typeof contact.mapUrl === "string" && contact.mapUrl.trim()) link(errors, "contact.mapUrl", contact.mapUrl);
  detailRows(errors, "contact.phones", contact.phones, 2, [
    ["label", 24],
    ["display", 40],
  ]);
  detailRows(errors, "contact.hours", contact.hours, 4, [
    ["days", 40],
    ["hours", 40],
  ]);
  return errors;
}

function pair(errors: FieldErrors, path: string, item: unknown, labelMax: number): void {
  const row = isRecord(item) ? item : {};
  text(errors, `${path}.label`, row.label, labelMax);
  link(errors, `${path}.href`, row.href);
}

function optionalText(errors: FieldErrors, path: string, value: unknown, max: number): void {
  if (value == null || value === "") return;
  text(errors, path, value, max, false);
}

function detailRows(
  errors: FieldErrors,
  path: string,
  value: unknown,
  maxRows: number,
  fields: Array<[string, number]>,
): void {
  if (value == null) return;
  if (!Array.isArray(value)) {
    errors[path] = "Add the rows for this section.";
    return;
  }
  if (value.length > maxRows) errors[path] = `Use at most ${maxRows} rows.`;
  value.slice(0, maxRows).forEach((item, index) => {
    const row = isRecord(item) ? item : {};
    const filled = fields.map(([key]) => (typeof row[key] === "string" ? row[key].trim() : ""));
    if (filled.every((part) => !part)) return;
    if (filled.some((part) => !part)) {
      errors[`${path}.${index}`] = "Fill in every part of the row, or leave the whole row blank.";
    }
    fields.forEach(([key, max], fieldIndex) => {
      if (!filled[fieldIndex]) return;
      text(errors, `${path}.${index}.${key}`, row[key], max);
    });
  });
}

export function validateSeo(document: unknown): FieldErrors {
  const errors: FieldErrors = {};
  if (!isRecord(document)) return { "": "The document must be an object." };
  text(errors, "title", document.title, 70);
  text(errors, "description", document.description, 160);
  const image = typeof document.shareImageUrl === "string" ? document.shareImageUrl.trim() : "";
  const alt = typeof document.shareImageAlt === "string" ? document.shareImageAlt.trim() : "";
  if (image) {
    link(errors, "shareImageUrl", image);
    text(errors, "shareImageAlt", alt, 140);
  } else if (alt) {
    errors.shareImageAlt = "Add an image before alt text, or clear the alt text.";
  }
  return errors;
}

const CURATED_GROUP_SET = new Set(["Deals", "By price", "By type", "Rentals", "By city"]);
const CURATED_TYPE_SET = new Set(["Detached", "Semi-Detached", "Townhome", "Condo", "Luxury"]);
const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const MLS_KEY_RE = /^[A-Z0-9][A-Z0-9._-]{2,39}$/i;

export function validateCurated(document: unknown): FieldErrors {
  const errors: FieldErrors = {};
  if (!isRecord(document)) return { "": "The document must be an object." };
  if (!Array.isArray(document.pages)) {
    errors.pages = "Pages must be a list.";
    return errors;
  }
  if (document.pages.length > 80) errors.pages = "Keep this to 80 searches or fewer.";
  const seen = new Set<string>();
  document.pages.forEach((item, index) => {
    const path = `pages.${index}`;
    const row = isRecord(item) ? item : {};
    const slug = text(errors, `${path}.slug`, row.slug, 80);
    if (slug && !SLUG_RE.test(slug)) {
      errors[`${path}.slug`] = "Use lowercase letters, numbers, and hyphens only.";
    }
    if (slug) {
      if (seen.has(slug)) errors[`${path}.slug`] = "Each slug must be unique.";
      seen.add(slug);
    }
    text(errors, `${path}.label`, row.label, 60);
    text(errors, `${path}.h1`, row.h1, 100);
    text(errors, `${path}.description`, row.description, 240);
    if (!CURATED_GROUP_SET.has(String(row.group ?? ""))) {
      errors[`${path}.group`] = "Pick a group.";
    }
    const query = isRecord(row.query) ? row.query : {};
    if (query.transaction != null && query.transaction !== "" && query.transaction !== "sale" && query.transaction !== "rent") {
      errors[`${path}.query.transaction`] = "Choose sale or rent.";
    }
    if (query.type != null && query.type !== "" && !CURATED_TYPE_SET.has(String(query.type))) {
      errors[`${path}.query.type`] = "Pick a property type.";
    }
    for (const key of [
      "priceMin",
      "priceMax",
      "bedsMin",
      "bathsMin",
      "sqftMin",
      "sqftMax",
      "yearBuiltMin",
      "yearBuiltMax",
      "garagesMin",
      "storiesMin",
      "storiesMax",
      "domMax",
      "kitchensMin",
      "feeMin",
      "feeMax",
    ] as const) {
      const value = query[key];
      if (value == null || value === "") continue;
      const n = Number(value);
      if (!Number.isFinite(n) || n < 0 || !Number.isInteger(n)) {
        errors[`${path}.query.${key}`] = "Enter a whole number.";
      }
    }
    if (
      query.basement != null &&
      query.basement !== "" &&
      !BASEMENT_VALUES.has(String(query.basement))
    ) {
      errors[`${path}.query.basement`] = "Pick a basement option.";
    }
    if (
      query.buildingType != null &&
      query.buildingType !== "" &&
      !(BUILDING_OPTIONS as readonly string[]).includes(String(query.buildingType))
    ) {
      errors[`${path}.query.buildingType`] = "Pick a building type.";
    }
    if (
      query.ownership != null &&
      query.ownership !== "" &&
      !(OWNERSHIP_OPTIONS as readonly string[]).includes(String(query.ownership))
    ) {
      errors[`${path}.query.ownership`] = "Pick an ownership type.";
    }
    if (query.listedSince != null && query.listedSince !== "") {
      if (typeof query.listedSince !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(query.listedSince)) {
        errors[`${path}.query.listedSince`] = "Use a YYYY-MM-DD date.";
      }
    }
    if (query.postalCodes != null && query.postalCodes !== "") {
      const raw =
        Array.isArray(query.postalCodes)
          ? query.postalCodes.filter((code): code is string => typeof code === "string").join(",")
          : String(query.postalCodes);
      const { invalid } = parsePostalList(raw);
      if (invalid.length) {
        errors[`${path}.query.postalCodes`] = `Invalid postal code: ${invalid[0]}`;
      }
    }
    if (Array.isArray(query.keywords)) {
      if (query.keywords.length > 20) errors[`${path}.query.keywords`] = "Use at most 20 keyword phrases.";
      query.keywords.forEach((word, wordIndex) => {
        if (typeof word !== "string" || !word.trim()) return;
        if (word.trim().length > 80) {
          errors[`${path}.query.keywords.${wordIndex}`] = "Keep each keyword to 80 characters or fewer.";
        }
      });
    } else if (query.keywords != null && query.keywords !== "") {
      errors[`${path}.query.keywords`] = "Keywords must be a list.";
    }

    const listingKeysRaw = row.listingKeys ?? row.listing_keys;
    if (listingKeysRaw != null && listingKeysRaw !== "") {
      const keys = normalizeListingKeys(listingKeysRaw);
      if (keys.length === 0) {
        errors[`${path}.listingKeys`] = "Add at least one MLS® number, or switch to Filter search.";
      } else if (keys.length > CURATED_LISTING_KEYS_MAX) {
        errors[`${path}.listingKeys`] = `Pin at most ${CURATED_LISTING_KEYS_MAX} MLS® numbers.`;
      } else {
        for (const key of keys) {
          if (!MLS_KEY_RE.test(key)) {
            errors[`${path}.listingKeys`] = `"${key}" does not look like an MLS® number.`;
            break;
          }
        }
      }
    }
  });
  return errors;
}

export function firstError(errors: FieldErrors): string | null {
  const message = Object.values(errors)[0];
  return message ?? null;
}
