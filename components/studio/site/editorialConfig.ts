/** Shared editorial resource config for list edit + dedicated create pages. */

export const FIELD_LABELS: Record<string, string> = {
  title: "Title",
  label: "Short tag",
  icon: "Icon",
  amount_text: "Amount shown",
  description: "Description",
  source_url: "Official source link",
  reviewed_at: "Last checked",
  is_active: "Show on the site",
  display_order: "Order on the page",
  name: "Name",
  category: "Category",
  website_url: "Website",
  logo_url: "Logo image",
  city_key: "City key",
  city_label: "City name",
  image_url: "Photo",
  credit: "Photo credit",
  source: "Source",
  url: "Article link",
  is_hidden: "Hide from the homepage",
};

export const FIELD_HINTS: Record<string, string> = {
  city_key: "Lowercase city name, such as mississauga or richmond hill. The tile uses this to find the photo.",
  display_order: "1 shows first. Existing rows keep their place when you add a new one.",
  reviewed_at: "Use a date like 2026-10-10, or leave it blank.",
  is_active: "Turn this off to keep the row here without showing it to visitors.",
  is_hidden: "Hidden headlines leave the homepage. The feed can still bring them back in.",
  image_url: "Upload a photo or paste an image link. At least 800×450 pixels.",
  logo_url: "Upload a logo or paste an image link.",
  url: "Full https link visitors open from the Daily News card.",
  icon: "Pick the glyph shown on the homepage card.",
};

export const IMAGE_FIELDS = new Set(["image_url", "logo_url"]);

export const INCENTIVE_ICONS = [
  { value: "home", label: "Home" },
  { value: "savings", label: "Savings" },
  { value: "green", label: "Green" },
  { value: "construction", label: "Construction" },
  { value: "equity", label: "Equity" },
  { value: "retirement", label: "Retirement" },
] as const;

export type EditorialResource = "incentives" | "partners" | "news";

export type EditorialResourceConfig = {
  resource: EditorialResource;
  title: string;
  createTitle: string;
  lede: string;
  createLede: string;
  listHref: string;
  idKey: string;
  fields: string[];
  createDefaults: Record<string, unknown>;
  headingKeys: string[];
};

export const EDITORIAL_RESOURCES: Record<EditorialResource, EditorialResourceConfig> = {
  incentives: {
    resource: "incentives",
    title: "Buyer incentives",
    createTitle: "New incentive",
    lede: "Programs shown in the homepage incentives section. Open a row to edit, then Save. Turn “Show on the site” off to hide a program without deleting it.",
    createLede: "Fill in the program details visitors should see. After you create it, you can fine-tune it from the incentives list.",
    listHref: "/studio/incentives",
    idKey: "id",
    fields: ["title", "label", "icon", "amount_text", "description", "source_url", "reviewed_at", "is_active", "display_order"],
    createDefaults: {
      title: "",
      label: "",
      icon: "home",
      amount_text: "",
      description: "",
      source_url: "",
      reviewed_at: "",
      is_active: true,
      display_order: 0,
    },
    headingKeys: ["title"],
  },
  partners: {
    resource: "partners",
    title: "Partners",
    createTitle: "New partner",
    lede: "Trusted connections on the homepage. Open a row to edit, then Save. A website link opens in a new tab. Turn “Show on the site” off to hide a partner without deleting it.",
    createLede: "Add a partner visitors should see in Trusted Connections. You can upload a logo and adjust order after creating.",
    listHref: "/studio/partners",
    idKey: "id",
    fields: ["name", "category", "description", "website_url", "logo_url", "is_active", "display_order"],
    createDefaults: {
      name: "",
      category: "Mortgage",
      description: "",
      website_url: "",
      logo_url: "",
      is_active: true,
      display_order: 0,
    },
    headingKeys: ["name"],
  },
  news: {
    resource: "news",
    title: "News",
    createTitle: "News",
    lede: "Homepage Daily News is a live GTA real-estate feed. Manual headlines are no longer created here.",
    createLede: "Manual headlines were removed. Use the News list to preview the live feed.",
    listHref: "/studio/news",
    idKey: "id",
    fields: ["title", "source", "url", "image_url", "is_hidden"],
    createDefaults: {
      title: "",
      source: "HomeAtlas",
      url: "",
      image_url: "",
      is_hidden: false,
    },
    headingKeys: ["title"],
  },
};

export function buildSaveBody(row: Record<string, unknown>, fields: string[]) {
  const body: Record<string, unknown> = {};
  for (const field of fields) {
    if (!(field in row)) continue;
    if (field === "display_order") {
      body.display_order = Number(row.display_order) || 0;
    } else if (field === "reviewed_at") {
      const raw = row.reviewed_at;
      body.reviewed_at = raw ? String(raw).slice(0, 10) : null;
    } else if (
      field === "source_url" ||
      field === "website_url" ||
      field === "logo_url" ||
      field === "url" ||
      field === "image_url"
    ) {
      body[field] = row[field] == null ? "" : String(row[field]).trim();
    } else if (field === "is_active" || field === "is_hidden") {
      body[field] = Boolean(row[field]);
    } else {
      body[field] = row[field];
    }
  }
  return body;
}

export function editorialHeading(row: Record<string, unknown>) {
  return String(row.title || row.name || row.city_label || "Untitled");
}

export function requiredCreateFields(resource: EditorialResource): string[] {
  if (resource === "partners") return ["name"];
  if (resource === "news") return ["title", "url"];
  return ["title"];
}
