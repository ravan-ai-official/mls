import type { ReactNode } from "react";
import { Navbar } from "@/components/layout/Navbar";
import { getChromeDocument } from "@/lib/site/load";
import { AuthModal } from "@/components/auth/AuthModal";
import { PhoneVerifyModal } from "@/components/auth/PhoneVerifyModal";
import { AiAssistant } from "@/components/assistant/AiAssistant";
import { CompareTray } from "@/components/property/CompareTray";

/**
 * Full-bleed layout for the map: no announcement bar and no footer.
 * Lock to the viewport so the map + list fill the space under the navbar
 * without a document scrollbar (navbar is 72px / lg:80px — don't hard-code).
 * CompareTray lives here so map pins / list cards can build a shortlist.
 */
export default async function MapLayout({ children }: { children: ReactNode }) {
  const chrome = await getChromeDocument();
  return (
    <div className="flex h-dvh flex-col overflow-hidden">
      <Navbar links={chrome?.nav.links} ctaLabel={chrome?.nav.ctaLabel} ctaHref={chrome?.nav.ctaHref} />
      <main id="main" className="min-h-0 flex-1 overflow-hidden">
        {children}
      </main>
      <CompareTray />
      <AuthModal />
      <PhoneVerifyModal />
      <AiAssistant />
    </div>
  );
}
