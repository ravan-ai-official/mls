import { Suspense, type ReactNode } from "react";
import type { Metadata } from "next";
import { AlertsCta } from "@/components/home/AlertsCta";
import { Hero } from "@/components/home/Hero";
import { BuyersIncentives } from "@/components/home/sections/BuyersIncentives";
import { DailyNews } from "@/components/home/sections/DailyNews";
import { FeaturedListings } from "@/components/home/sections/FeaturedListings";
import { GtaMarketDeals } from "@/components/home/sections/GtaMarketDeals";
import { HighReturnProperties } from "@/components/home/sections/HighReturnProperties";
import { HowItWorks } from "@/components/home/sections/HowItWorks";
import { MarketIntelligence } from "@/components/home/sections/MarketIntelligence";
import { NeighbourAlerts } from "@/components/home/sections/NeighbourAlerts";
import { NewPrecon } from "@/components/home/sections/NewPrecon";
import { PropertyTypes } from "@/components/home/sections/PropertyTypes";
import { QuickActions } from "@/components/home/sections/QuickActions";
import { ResearchInsights } from "@/components/home/sections/ResearchInsights";
import { ResourcesGuides } from "@/components/home/sections/ResourcesGuides";
import { ProfitableInvestments } from "@/components/home/sections/ProfitableInvestments";
import { SoldBelowLastPurchase } from "@/components/home/sections/SoldBelowLastPurchase";
import { ThinkingOfSelling } from "@/components/home/sections/ThinkingOfSelling";
import { TodaysNewListings } from "@/components/home/sections/TodaysNewListings";
import { TopRatedSchoolsLive } from "@/components/home/sections/TopRatedSchoolsLive";
import {
  TrendingCommunities,
  TrendingCommunitiesSkeleton,
} from "@/components/home/sections/TrendingCommunities";
import { TrustedConnections } from "@/components/home/sections/TrustedConnections";
import { KeywordLinks } from "@/components/search/KeywordLinks";
import { WhyHomeAtlas } from "@/components/home/sections/WhyHomeAtlas";
import { Section } from "@/components/ui/Section";
import { PropertyGridSkeleton } from "@/components/ui/States";
import { getCuratedPages, getHomepageDocument } from "@/lib/site/load";
import { SECTION_IDS, type SectionId, type SiteSection } from "@/lib/site/types";

/**
 * Homepage — section order follows HomeAtlasUI's HomePage.tsx, as specified
 * by the product owner:
 *
 *   hero → buy/rent/precon/sell → trending communities → featured MLS
 *   listings → property types → new precon → today's new listings → high
 *   return → GTA market deals → sold below last purchase → profitable
 *   investments → top-rated schools
 *   → buyer's incentives → market intelligence → neighbour alerts → smart
 *   alerts → thinking of selling → why HomeAtlas → research & insights →
 *   trusted connections → how it works → daily news → resources & guides
 *
 * Live sections fetch from mls-v2 and stream in behind Suspense, so one slow
 * endpoint never holds up the page. Sections with no backend yet render the
 * reference's sample data (lib/home/*); what each needs is tracked in
 * docs/HOMEPAGE_BACKEND_REQUIREMENTS.xlsx.
 */

export const revalidate = 600;

// Title/description come from the root layout; only the canonical is page-specific.
export const metadata: Metadata = { alternates: { canonical: "/" } };

export default async function HomePage() {
  const document = await getHomepageDocument();
  const sections = document?.sections?.length
    ? document.sections
    : SECTION_IDS.map((id) => ({ id, visible: true, content: {} }));

  return (
    <>
      {sections.map((section) =>
        section.visible || section.id === "hero" ? <HomeBlock key={section.id} section={section} /> : null,
      )}
    </>
  );
}

function HomeBlock({ section }: { section: SiteSection }) {
  const content = section.content;
  switch (section.id as SectionId) {
    case "hero":
      return <Hero content={content} />;
    case "quickActions":
      return <QuickActions content={content} />;
    case "trendingCommunities":
      return (
        <Live fallback={<TrendingCommunitiesSkeleton />}>
          <TrendingCommunities content={content} />
        </Live>
      );
    case "featuredListings":
      return (
        <Live fallback={<RailFallback title="Featured MLS listings" />}>
          <FeaturedListings content={content} />
        </Live>
      );
    case "propertyTypes":
      return (
        <Live fallback={null}>
          <PropertyTypes content={content} />
        </Live>
      );
    case "newPrecon":
      return (
        <Live fallback={<RailFallback title="Pre-construction deals" />}>
          <NewPrecon content={content} />
        </Live>
      );
    case "todaysNew":
      return (
        <Live fallback={<RailFallback title="Today's new listings" />}>
          <TodaysNewListings content={content} />
        </Live>
      );
    case "highReturn":
      return (
        <Live fallback={<RailFallback title="High Return Properties" tone="dark" />}>
          <HighReturnProperties content={content} />
        </Live>
      );
    case "marketDeals":
      return <GtaMarketDeals content={content} />;
    case "soldBelow":
      // Skeleton only while loading; empty feed shows EmptyState (no mock cards).
      return (
        <Live fallback={<RailFallback title="Sold Below Last Purchase" />}>
          <SoldBelowLastPurchase content={content} />
        </Live>
      );
    case "profitableInvestments":
      return (
        <Live fallback={<RailFallback title="Profitable Investments" />}>
          <ProfitableInvestments content={content} />
        </Live>
      );
    case "schools":
      return (
        <Live fallback={<RailFallback title="GTA Secondary Schools" tone="alt" />}>
          <TopRatedSchoolsLive content={content} />
        </Live>
      );
    case "incentives":
      return (
        <Live fallback={null}>
          <BuyersIncentives content={content} />
        </Live>
      );
    case "marketIntelligence":
      return (
        <Live fallback={null}>
          <MarketIntelligence content={content} />
        </Live>
      );
    case "neighbourAlerts":
      return (
        <Live fallback={null}>
          <NeighbourAlerts content={content} />
        </Live>
      );
    case "alertsCta":
      return <AlertsCta content={content} />;
    case "thinkingOfSelling":
      return <ThinkingOfSelling content={content} />;
    case "whyHomeAtlas":
      return <WhyHomeAtlas content={content} />;
    case "research":
      return (
        <Live fallback={null}>
          <ResearchInsights content={content} />
        </Live>
      );
    case "partners":
      return (
        <Live fallback={null}>
          <TrustedConnections content={content} />
        </Live>
      );
    case "howItWorks":
      return <HowItWorks content={content} />;
    case "dailyNews":
      return (
        <Live fallback={null}>
          <DailyNews content={content} />
        </Live>
      );
    case "resources":
      return <ResourcesGuides content={content} />;
    case "keywords":
      return (
        <Section
          eyebrow={typeof content.eyebrow === "string" ? content.eyebrow : "Popular searches"}
          title={typeof content.title === "string" ? content.title : "Search by keywords"}
        >
          <Live fallback={<p className="text-small text-ink-muted">Loading popular searches…</p>}>
            <KeywordLinksLive />
          </Live>
        </Section>
      );
    default:
      return null;
  }
}

/** Streams a data-backed section so the rest of the page isn't blocked on it. */
function Live({ fallback, children }: { fallback: ReactNode; children: ReactNode }) {
  return <Suspense fallback={fallback}>{children}</Suspense>;
}

async function KeywordLinksLive() {
  const pages = await getCuratedPages();
  return <KeywordLinks pages={pages} />;
}

function RailFallback({ title, tone }: { title: string; tone?: "default" | "alt" | "dark" }) {
  return (
    <Section title={title} tone={tone}>
      <PropertyGridSkeleton count={3} />
    </Section>
  );
}
