"use client";

import { useEffect, useState } from "react";
import { HeroFrame } from "@/components/home/HeroFrame";
import { QuickActions } from "@/components/home/sections/QuickActions";
import { AlertsCta } from "@/components/home/AlertsCta";
import { GtaMarketDeals } from "@/components/home/sections/GtaMarketDeals";
import { HowItWorks } from "@/components/home/sections/HowItWorks";
import { ResourcesGuides } from "@/components/home/sections/ResourcesGuides";
import { ThinkingOfSelling } from "@/components/home/sections/ThinkingOfSelling";
import { TopRatedSchools } from "@/components/home/sections/TopRatedSchools";
import { WhyHomeAtlas } from "@/components/home/sections/WhyHomeAtlas";
import { AnnouncementBar } from "@/components/layout/AnnouncementBar";
import { Footer } from "@/components/layout/Footer";
import { Navbar } from "@/components/layout/Navbar";
import { KeywordLinks } from "@/components/search/KeywordLinks";
import { Section } from "@/components/ui/Section";
import { mergeCuratedPages, type CuratedDocument } from "@/lib/seo/curatedPages";
import type { ChromeDocument, HomepageDocument, SectionId, SeoDocument } from "@/lib/site/types";

interface Payload {
  kind: "homepage" | "header" | "footer" | "seo" | "curated";
  document: HomepageDocument | ChromeDocument | SeoDocument | CuratedDocument;
  sectionId?: SectionId;
  fullPage?: boolean;
}

export function PreviewCanvas() {
  const [payload, setPayload] = useState<Payload | null>(null);

  useEffect(() => {
    function onMessage(event: MessageEvent) {
      if (event.origin !== window.location.origin) return;
      if (event.data?.type === "site-preview") setPayload(event.data.payload as Payload);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        window.parent.postMessage({ type: "site-preview-close" }, window.location.origin);
      }
    }
    window.addEventListener("message", onMessage);
    window.addEventListener("keydown", onKey);
    window.parent.postMessage({ type: "site-preview-ready" }, window.location.origin);
    return () => {
      window.removeEventListener("message", onMessage);
      window.removeEventListener("keydown", onKey);
    };
  }, []);

  if (!payload) {
    return <p className="p-6 text-small text-ink-muted">Preview will appear as you edit.</p>;
  }
  if (payload.kind === "header") {
    const chrome = payload.document as ChromeDocument;
    return (
      <>
        <AnnouncementBar items={chrome.announcement.items} />
        <Navbar links={chrome.nav.links} ctaLabel={chrome.nav.ctaLabel} ctaHref={chrome.nav.ctaHref} />
      </>
    );
  }
  if (payload.kind === "footer") {
    return <Footer footer={(payload.document as ChromeDocument).footer} />;
  }
  if (payload.kind === "seo") {
    const seo = payload.document as SeoDocument;
    return (
      <div className="p-8">
        <p className="text-caption text-ink-muted">Search result</p>
        <p className="mt-2 text-h3 text-navy">{seo.title}</p>
        <p className="mt-1 max-w-xl text-small text-ink-muted">{seo.description}</p>
      </div>
    );
  }
  if (payload.kind === "curated") {
    const pages = mergeCuratedPages(payload.document);
    return (
      <div className="p-6">
        <Section eyebrow="Popular searches" title="Search by keywords">
          <KeywordLinks pages={pages} />
        </Section>
      </div>
    );
  }
  const homepage = payload.document as HomepageDocument;
  const sections = payload.fullPage
    ? homepage.sections.filter((section) => section.visible || section.id === "hero")
    : homepage.sections.filter((section) => section.id === payload.sectionId);
  return (
    <>
      {sections.map((section) => (
        <SectionPreview key={section.id} id={section.id} content={section.content} />
      ))}
    </>
  );
}

function SectionPreview({ id, content }: { id: SectionId; content: Record<string, unknown> }) {
  if (id === "hero") {
    return (
      <HeroFrame content={content}>
        <p className="mt-6 text-small text-white/75">Live MLS® count appears here on the public site.</p>
      </HeroFrame>
    );
  }
  if (id === "quickActions") return <QuickActions content={content} />;
  if (id === "marketDeals") return <GtaMarketDeals content={content} />;
  if (id === "schools") return <TopRatedSchools content={content} />;
  if (id === "alertsCta") return <AlertsCta content={content} />;
  if (id === "thinkingOfSelling") return <ThinkingOfSelling content={content} />;
  if (id === "whyHomeAtlas") return <WhyHomeAtlas content={content} />;
  if (id === "howItWorks") return <HowItWorks content={content} />;
  if (id === "resources") return <ResourcesGuides content={content} />;
  if (id === "keywords") {
    return (
      <Section eyebrow={String(content.eyebrow || "")} title={String(content.title || "")}>
        <KeywordLinks />
      </Section>
    );
  }
  return (
    <Section
      eyebrow={typeof content.eyebrow === "string" ? content.eyebrow : undefined}
      title={typeof content.title === "string" ? content.title : undefined}
      description={typeof content.description === "string" ? content.description : undefined}
      action={
        typeof content.actionLabel === "string" && typeof content.actionHref === "string"
          ? { label: content.actionLabel, href: content.actionHref }
          : undefined
      }
    >
      <p className="rounded-control border border-dashed border-line px-4 py-8 text-center text-small text-ink-muted">
        Live listings and feeds appear here on the public site. This preview checks the heading, description, and spacing.
      </p>
    </Section>
  );
}
