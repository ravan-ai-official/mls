import type { ReactNode } from "react";
import { AnnouncementBar } from "@/components/layout/AnnouncementBar";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { ScrollToTop } from "@/components/layout/ScrollToTop";
import { getChromeDocument } from "@/lib/site/load";
import { AuthModal } from "@/components/auth/AuthModal";
import { PhoneVerifyModal } from "@/components/auth/PhoneVerifyModal";
import { AiAssistant } from "@/components/assistant/AiAssistant";
import { CompareTray } from "@/components/property/CompareTray";

/** Chrome-wrapped pages. The map search route uses its own full-bleed layout. */
export default async function SiteLayout({ children }: { children: ReactNode }) {
  const chrome = await getChromeDocument();
  return (
    <>
      <AnnouncementBar items={chrome?.announcement.items} />
      <Navbar links={chrome?.nav.links} ctaLabel={chrome?.nav.ctaLabel} ctaHref={chrome?.nav.ctaHref} />
      <main id="main" className="flex-1">
        {children}
      </main>
      <Footer footer={chrome?.footer} />
      <AuthModal />
      <PhoneVerifyModal />
      {/* Mounted at layout level so a compare selection survives navigation. */}
      <CompareTray />
      <AiAssistant />
      <ScrollToTop />
    </>
  );
}
