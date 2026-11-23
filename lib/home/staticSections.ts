/**
 * Inline section data from HomeAtlasUI/src/pages/HomePage.tsx, ported where a
 * live feed does not yet own the rail (e.g. keyword deal cards, incentives).
 *
 * Sold-below is live via mls-backend and must never use sample cards here.
 */

/* GTA MARKET DEALS (reference L548-588) */

export type DealIcon = "distress" | "detached" | "powerOfSale" | "sold";
export type DealBadgeTone = "gold" | "navy" | "dark";

export interface MarketDeal {
  title: string;
  desc: string;
  icon: DealIcon;
  badge: string;
  badgeTone: DealBadgeTone;
  count: string;
  /** Curated `/homes/...` page or a listings search. */
  href: string;
}

export const marketDeals: MarketDeal[] = [
  {
    title: "Distress Deals",
    desc: "Properties priced to move fast — motivated sellers, below-market opportunities.",
    icon: "distress",
    badge: "Urgent",
    badgeTone: "gold",
    count: "24 listings",
    href: "/homes/distress-sale",
  },
  {
    title: "Detached Under $1M in GTA",
    desc: "Rare detached homes under $1 million in the Greater Toronto Area.",
    icon: "detached",
    badge: "Value",
    badgeTone: "navy",
    count: "31 listings",
    href: "/homes/detached-under-1m",
  },
  {
    title: "Power of Sale",
    desc: "Court-ordered and lender-owned properties — often below market value.",
    icon: "powerOfSale",
    badge: "Legal",
    badgeTone: "dark",
    count: "12 listings",
    href: "/homes/power-of-sale",
  },
  {
    title: "Just Sold",
    desc: "See the latest sold transactions to understand true market value.",
    icon: "sold",
    badge: "Recent",
    badgeTone: "gold",
    count: "189 sold",
    href: "/listings?status=Sold",
  },
];

/* BUYER'S INCENTIVES (reference L717-723) */

export type IncentiveIcon = "home" | "savings" | "green" | "construction" | "equity" | "retirement";

export interface BuyerIncentive {
  label: string;
  title: string;
  amount: string;
  desc: string;
  icon: IncentiveIcon;
}

export const buyerIncentives: BuyerIncentive[] = [
  { label: "FIRST-TIME BUYER", title: "First-Time Buyer Rebate", amount: "Up to $6,475", desc: "Ontario and Toronto land transfer tax rebates for first-time buyers purchasing their primary residence.", icon: "home" },
  { label: "TAX SAVINGS", title: "FHSA – Tax-Free Savings", amount: "Up to $40,000", desc: "The First Home Savings Account lets you save up to $8,000/year tax-free toward your first home.", icon: "savings" },
  { label: "GREEN HOMES", title: "Green Home Incentives", amount: "Up to $5,000", desc: "Federal rebates for purchasing energy-efficient homes or upgrading to qualify for green certification.", icon: "green" },
  { label: "NEW CONSTRUCTION", title: "GST/HST New Housing Rebate", amount: "Up to $24,000", desc: "Rebate for newly constructed or substantially renovated homes used as your primary residence.", icon: "construction" },
  { label: "SHARED EQUITY", title: "Shared Equity Program", amount: "5–10% Equity", desc: "CMHC's First-Time Home Buyer Incentive provides shared equity mortgage to reduce monthly payments.", icon: "equity" },
  { label: "RETIREMENT SAVINGS", title: "Home Buyers' Plan (RRSP)", amount: "Up to $35,000", desc: "Withdraw up to $35,000 from your RRSP tax-free to purchase or build your first qualifying home.", icon: "retirement" },
];

/* MARKET INTELLIGENCE (reference L768-819) */

export interface MarketStat {
  label: string;
  value: string;
  change: string;
  up: boolean;
}

export const gtaMarketSnapshot: MarketStat[] = [
  { label: "Avg. Sale Price", value: "$1,056K", change: "+3.2%", up: true },
  { label: "Days on Market", value: "24 days", change: "-5 days", up: false },
  { label: "Mortgage Rate", value: "5.14%", change: "+0.25%", up: true },
];

export const marketReportCities = ["Toronto", "Mississauga", "Vaughan", "Oakville"] as const;

export const soldDataTeaser: Array<{ label: string; value: string; highlight?: boolean }> = [
  { label: "Last 90 days", value: "1,842 homes" },
  { label: "Avg. sold price", value: "$1.08M" },
  { label: "Over asking", value: "62% of homes", highlight: true },
];
