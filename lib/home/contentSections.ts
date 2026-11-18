/**
 * Inline content from HomeAtlasUI/src/pages/HomePage.tsx L832-1227, ported
 * verbatim for the homepage's editorial / marketing sections.
 *
 * REFERENCE SAMPLE CONTENT. The neighbour-activity feed, news headlines and
 * guide blurbs have no backend source; per the product decision they render as
 * the reference shows them. The activity feed is not MLS® data, so nothing here
 * links to /property/<id>. Emoji icons from the reference are replaced by keys
 * that map to inline SVGs in components/home/sections/contentIcons.tsx.
 */

/* NEIGHBOUR SELLING / RENTER ALERTS (reference L845-879) */

export const neighbourAlertPoints: string[] = [
  "Get alerted when a home near you is listed or sold",
  "Renters: know if your building or street is for sale",
  "Track your neighbourhood's price movement",
  "First-look at properties before they go live",
];

export type NeighbourEvent = "Just Listed" | "Price Drop" | "Open House" | "Just Sold";

export interface NeighbourActivity {
  address: string;
  event: NeighbourEvent;
  price: string;
  daysAgo: string;
  img: string;
}

export const neighbourActivity: NeighbourActivity[] = [
  { address: "44 Elm Street", event: "Just Listed", price: "$1.18M", daysAgo: "Today", img: "https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=400&h=250&fit=crop" },
  { address: "91 Cedar Lane", event: "Price Drop", price: "$879K ↓", daysAgo: "2 days ago", img: "https://images.unsplash.com/photo-1605276373954-0c4a0dac5b12?w=400&h=250&fit=crop" },
  { address: "18 Birchwood Ave", event: "Open House", price: "$1.42M", daysAgo: "This weekend", img: "https://images.unsplash.com/photo-1568605114967-8130f3a36994?w=400&h=250&fit=crop" },
  { address: "230 Oak Blvd", event: "Just Sold", price: "$1.07M", daysAgo: "3 days ago", img: "https://images.unsplash.com/photo-1583608205776-bfd35f0d9f83?w=400&h=250&fit=crop" },
];

/* THINKING OF SELLING (reference L991) */

/**
 * The reference's `imgLuxuryLivingRoom` asset is a 0-byte file in HomeAtlasUI,
 * so an Unsplash living-room photo stands in for it.
 */
export const sellingImage =
  "https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?w=900&h=720&fit=crop";

/* WHY HOMEATLAS (reference L1006-1011) */

export type AdvantageIcon = "mls" | "precon" | "local" | "guidance";

export interface Advantage {
  title: string;
  desc: string;
  icon: AdvantageIcon;
}

export const advantages: Advantage[] = [
  { title: "MLS Access", desc: "2,300+ daily-updated MLS listings across the entire GTA, with full data transparency.", icon: "mls" },
  { title: "Preconstruction Experts", desc: "First access to new developments with insider pricing and VIP release notifications.", icon: "precon" },
  { title: "Local Market Knowledge", desc: "Neighbourhood-level data, school ratings, and community insights built in.", icon: "local" },
  { title: "Personalized Guidance", desc: "Tailored recommendations + dedicated agents who know the GTA inside out.", icon: "guidance" },
];

/* RESEARCH & INSIGHTS (reference L1031-1034) */

export interface ResearchCard {
  title: string;
  desc: string;
  img: string;
  /** The reference sent all three to market-trends; each now has its own page. */
  href: string;
}

export const researchCards: ResearchCard[] = [
  { title: "Price Trends", desc: "Find property rates & price trends for top GTA locations.", img: "https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=600&h=300&fit=crop", href: "/market-trends" },
  { title: "City Insights", desc: "Get to know GTA communities before you invest.", img: "https://images.unsplash.com/photo-1477959858617-67f85cf4f1df?w=600&h=300&fit=crop", href: "/communities" },
  { title: "Housing Research", desc: "Find reports on the GTA residential real estate market.", img: "https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=600&h=300&fit=crop", href: "/blog" },
];

/* TRUSTED CONNECTIONS (reference L1066-1071) */

export type ConnectionIcon = "legal" | "mortgage" | "inspection" | "planning" | "insurance" | "moving";

export interface TrustedConnection {
  category: string;
  title: string;
  desc: string;
  icon: ConnectionIcon;
}

export const trustedConnections: TrustedConnection[] = [
  { category: "LEGAL PARTNERS", title: "Attorneys", desc: "Expert real estate lawyers to ensure smooth title transfers and legal compliance.", icon: "legal" },
  { category: "FINANCIAL EXPERTS", title: "Mortgage Brokers", desc: "Get the best rates and personalized financing solutions for your dream home.", icon: "mortgage" },
  { category: "PROPERTY GUARD", title: "Home Inspectors", desc: "Detailed inspections to identify potential issues before you make an offer.", icon: "inspection" },
  { category: "INVESTMENT ADVISORS", title: "Financial Planners", desc: "Maximize your real estate investment with expert portfolio and tax planning.", icon: "planning" },
  { category: "INSURANCE PARTNERS", title: "Home Insurance", desc: "Comprehensive coverage specialists to protect your most valuable asset.", icon: "insurance" },
  { category: "MOVING SERVICES", title: "Trusted Movers", desc: "Vetted, reliable moving companies to make your relocation seamless.", icon: "moving" },
];

/* HOW IT WORKS (reference L1108-1111) */

export interface HowItWorksStep {
  num: number;
  title: string;
  desc: string;
}

export const howItWorksSteps: HowItWorksStep[] = [
  { num: 1, title: "Create your free HomeAtlas account", desc: "Set up your preferences, search criteria, and start receiving personalized listing alerts matched to your needs." },
  { num: 2, title: "Discover your perfect GTA property", desc: "Browse 2,300+ daily-updated MLS listings with detailed search, interactive map, and community insights — all in one place." },
  { num: 3, title: "Close with confidence", desc: "Connect with top-rated GTA agents, get expert market guidance, legal support, and full transparency on sold prices and market trends." },
];

/* DAILY REAL ESTATE & FINANCIAL NEWS (reference L1145-1148) */

export interface NewsArticle {
  title: string;
  time: string;
  tag: string | null;
  img: string | null;
}

export const newsArticles: NewsArticle[] = [
  { title: "GTA Home Sales Rise 8.3% in August as Buyers Return to Market", time: "2 hours ago", tag: null, img: "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=400&h=220&fit=crop" },
  { title: "Bank of Canada Signals Another Rate Cut as Inflation Eases to 1.9%", time: "9 hours ago", tag: "Mortgage Rates", img: "https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=400&h=220&fit=crop" },
  { title: "Pre-Construction Condo Assignments Surge 42% as Investors Pivot Strategy", time: "Yesterday", tag: null, img: "https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=400&h=220&fit=crop" },
  { title: "Ontario Announces New Affordable Housing Measures Including FHSA Limit Increase", time: "3 days ago", tag: "Policy", img: "https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=400&h=220&fit=crop" },
];

/* RESOURCES & GUIDES (reference L1205-1208) */

export interface Guide {
  title: string;
  tag: string;
  desc: string;
  /** No guide pages exist; each opens the closest live page. */
  href: string;
}

export const guides: Guide[] = [
  { title: "The GTA Buying Guide", tag: "Buy", desc: "Everything first-time buyers need to know about purchasing in the GTA.", href: "/blog" },
  { title: "Market Insights", tag: "Insights", desc: "Monthly analysis of pricing trends, DOM stats, and neighbourhood reports.", href: "/market-trends" },
  { title: "Neighbourhood Need Guide", tag: "Explore", desc: "A deep dive into each GTA community: schools, transit, lifestyle.", href: "/communities" },
  { title: "Selling in 2025", tag: "Sell", desc: "How to price, stage, and sell your home for maximum value this year.", href: "/sell" },
];
