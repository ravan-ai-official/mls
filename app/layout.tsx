import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import { Inter, Geist } from "next/font/google";
import "./globals.css";
import { CookieConsent } from "@/components/consent/CookieConsent";
import { NavigationProgress } from "@/components/navigation/NavigationProgress";
import { AuthProvider } from "@/components/providers/AuthProvider";
import { PublicConnectionsProvider } from "@/components/providers/PublicConnections";
import { QueryProvider } from "@/components/providers/QueryProvider";
import { WatchedProvider } from "@/components/providers/WatchedProvider";
import { JsonLd, SITE_URL, absoluteUrl } from "@/components/seo/JsonLd";
import { getCurrentUser } from "@/lib/auth/session";
import { WhatsappProvider } from "@/components/providers/WhatsappProvider";
import { getPublicConnections } from "@/lib/api/integrations";
import { getSeoDocument, getWhatsappNumber } from "@/lib/site/load";
import { cn } from "@/lib/utils";

const geist = Geist({subsets:['latin'],variable:'--font-sans'});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

export async function generateMetadata(): Promise<Metadata> {
  const [seo, connections] = await Promise.all([getSeoDocument(), getPublicConnections()]);
  const title = seo?.title || "HomeAtlas — GTA Real Estate Intelligence";
  const description =
    seo?.description ||
    "Search active MLS® listings across the Greater Toronto Area, track market trends, and get an instant home valuation.";
  let metadataBase: URL;
  try {
    metadataBase = new URL(connections.siteUrl || process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000");
  } catch {
    metadataBase = new URL("http://localhost:3000");
  }
  return {
    title: { default: title, template: "%s · HomeAtlas" },
    description,
    metadataBase,
    openGraph: {
      siteName: "HomeAtlas",
      type: "website",
      locale: "en_CA",
      title,
      description,
      images: seo?.shareImageUrl ? [{ url: seo.shareImageUrl, alt: seo.shareImageAlt || title }] : undefined,
    },
  };
}

/*
 * Site-wide structured data: who publishes the site, and a sitelinks search
 * box pointed at the listings search (`q` is what /listings reads).
 */
const SITE_JSON_LD = [
  {
    "@context": "https://schema.org",
    "@type": "RealEstateAgent",
    "@id": `${SITE_URL}/#organization`,
    name: "HomeAtlas",
    url: absoluteUrl("/"),
    areaServed: { "@type": "Place", name: "Greater Toronto Area, Ontario, Canada" },
  },
  {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": `${SITE_URL}/#website`,
    name: "HomeAtlas",
    url: absoluteUrl("/"),
    publisher: { "@id": `${SITE_URL}/#organization` },
    inLanguage: "en-CA",
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${SITE_URL}/listings?search={search_term_string}`,
      },
      "query-input": "required name=search_term_string",
    },
  },
];

export const viewport: Viewport = {
  themeColor: "#1b2e4b",
  width: "device-width",
  initialScale: 1,
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  // Parallel so chrome/session never serializes three round-trips on every page.
  const [user, connections, whatsappNumber] = await Promise.all([
    getCurrentUser(),
    getPublicConnections(),
    getWhatsappNumber(),
  ]);

  return (
    <html lang="en-CA" className={cn("h-full", inter.variable, "font-sans", geist.variable)}>
      <body className="flex min-h-full flex-col bg-surface font-sans text-ink">
        <JsonLd data={SITE_JSON_LD} />
        <a
          href="#main"
          className="sr-only rounded-control bg-navy px-4 py-2 text-white focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[300]"
        >
          Skip to main content
        </a>
        <QueryProvider>
          <PublicConnectionsProvider value={connections}>
            <AuthProvider initialUser={user}>
              <WhatsappProvider number={whatsappNumber}>
                <WatchedProvider>
                  <Suspense fallback={null}>
                    <NavigationProgress />
                  </Suspense>
                  {children}
                  <CookieConsent
                    gaMeasurementId={connections.gaMeasurementId}
                    metaPixelId={connections.metaPixelId}
                    googleAdsId={connections.googleAdsId}
                  />
                </WatchedProvider>
              </WhatsappProvider>
            </AuthProvider>
          </PublicConnectionsProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
