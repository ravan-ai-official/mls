/** Documents the admin console edits. The backend is the source of truth for limits. */

export const SITE_KEYS = ["homepage", "chrome", "seo", "curated"] as const;
export type SiteKey = (typeof SITE_KEYS)[number];

export const SECTION_IDS = [
  "hero",
  "quickActions",
  "trendingCommunities",
  "featuredListings",
  "propertyTypes",
  "newPrecon",
  "todaysNew",
  "highReturn",
  "marketDeals",
  "soldBelow",
  "schools",
  "incentives",
  "marketIntelligence",
  "neighbourAlerts",
  "alertsCta",
  "thinkingOfSelling",
  "whyHomeAtlas",
  "research",
  "partners",
  "howItWorks",
  "dailyNews",
  "resources",
  "keywords",
] as const;

export type SectionId = (typeof SECTION_IDS)[number];

export interface SiteSection {
  id: SectionId;
  visible: boolean;
  content: Record<string, unknown>;
}

export interface HomepageDocument {
  sections: SiteSection[];
}

export interface LinkItem {
  label: string;
  href: string;
}

export interface ChromeDocument {
  announcement: { items: Array<LinkItem & { text: string }> };
  nav: { links: LinkItem[]; ctaLabel: string; ctaHref: string };
  footer: {
    bannerEyebrow: string;
    bannerHeading: string;
    bannerLabel: string;
    bannerHref: string;
    blurb: string;
    socials: Array<{ network: "facebook" | "instagram" | "youtube" | "x" | "linkedin"; href: string }>;
    columns: Array<{ heading: string; links: LinkItem[] }>;
  };
  contact: {
    whatsapp: string;
    name?: string;
    title?: string;
    email?: string;
    phones?: Array<{ label: string; display: string }>;
    address?: string;
    mapUrl?: string;
    hours?: Array<{ days: string; hours: string }>;
  };
}

export interface SeoDocument {
  title: string;
  description: string;
  shareImageUrl: string;
  shareImageAlt: string;
}

/** Re-export for Studio; pages live in lib/seo/curatedPages. */
export type { CuratedDocument } from "@/lib/seo/curatedPages";

export interface SiteRecord<T> {
  key: SiteKey;
  draft: T;
  published: T;
  updatedAt: string;
  publishedAt: string | null;
  dirty: boolean;
}

export interface SiteRevision {
  id: number;
  createdAt: string;
  createdBy: string;
}

export const SECTION_META: Record<SectionId, { label: string; summary: string; canHide: boolean }> = {
  hero: {
    label: "Hero",
    summary:
      "Background photo, heading, AI “Try” prompts, and the Filters-tab dropdowns (intents, types, prices, beds/baths).",
    canHide: false,
  },
  quickActions: { label: "Quick actions", summary: "The Buy, Rent, Preconstruction, and Sell cards under the hero.", canHide: true },
  trendingCommunities: { label: "Trending communities", summary: "Heading only. City tiles come from live inventory.", canHide: true },
  featuredListings: {
    label: "Featured listings",
    summary:
      "Heading around the rail. Admin pins under Featured homes always lead; empty slots follow visitor search history and IP city.",
    canHide: true,
  },
  propertyTypes: {
    label: "Property types",
    summary:
      "The six type tiles (Detached, Semi-Detached, Townhomes, Luxury, Condos, Rentals) and their links. Counts stay live.",
    canHide: true,
  },
  newPrecon: {
    label: "Pre-construction deals",
    summary:
      "Heading only. Featured precon rail (pinned first); with search history, scopes by remembered cities and beds/baths/price. Never uses IP city.",
    canHide: true,
  },
  todaysNew: { label: "Today's new listings", summary: "Heading only. The 24-hour subtitle stays automatic so it never overclaims.", canHide: true },
  highReturn: {
    label: "High return",
    summary: "Heading and caption. Which homes appear is set under High return homes.",
    canHide: true,
  },
  marketDeals: { label: "Market deals", summary: "Heading only. Four keyword deal cards (Distress, Detached Under $1M, Power of Sale, Just Sold).", canHide: true },
  soldBelow: {
    label: "Sold below purchase",
    summary:
      "Heading only. Cards come from live sold-below feed, preferring visitor search history and IP city.",
    canHide: true,
  },
  schools: {
    label: "Top-rated schools",
    summary:
      "Heading and optional school names. Named cards lead when they match Ministry schools; otherwise EQAO results follow visitor search history and IP city.",
    canHide: true,
  },
  incentives: { label: "Buyer incentives", summary: "Heading only. The programs themselves are edited under Incentives.", canHide: true },
  marketIntelligence: { label: "Market intelligence", summary: "Heading only. The snapshot figures stay live.", canHide: true },
  neighbourAlerts: {
    label: "Neighbour alerts",
    summary:
      "Heading, bullets, and WhatsApp message. Activity cards come from the live feed, preferring visitor search history and IP city.",
    canHide: true,
  },
  alertsCta: { label: "Smart alerts", summary: "Heading and the three alert labels. The form still saves real alerts.", canHide: true },
  thinkingOfSelling: { label: "Thinking of selling", summary: "The split call-to-action, buttons, and photo.", canHide: true },
  whyHomeAtlas: { label: "Why HomeAtlas", summary: "The advantage cards.", canHide: true },
  research: { label: "Research and insights", summary: "Topic cards. The latest posts still come from the blog.", canHide: true },
  partners: { label: "Trusted connections", summary: "Heading only. Partner cards are edited under Partners.", canHide: true },
  howItWorks: { label: "How it works", summary: "Steps and the WhatsApp message.", canHide: true },
  dailyNews: { label: "Daily news", summary: "Heading and the newsletter blurb. Headlines come from the news feed.", canHide: true },
  resources: { label: "Resources and guides", summary: "Guide cards and their links.", canHide: true },
  keywords: {
    label: "Keyword searches",
    summary:
      "Heading copy for this homepage block. Use Open Keyword searches editor (or Listings → Keyword searches) to map chips to search filters and/or pinned MLS® numbers on /homes pages.",
    canHide: true,
  },
};
