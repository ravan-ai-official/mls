"use client";

import { useEffect, useRef } from "react";
import { SaveButton } from "@/components/property/SaveButton";
import { cn } from "@/lib/utils/cn";

/**
 * Fixed mobile action bar: Save · Share · Inquire.
 * Publishes --mobile-cta-height so FABs (assistant, scroll-top) clear the bar.
 */
export function PropertyMobileCta({
  listingKey,
  address,
  url,
  canSave,
}: {
  listingKey: string;
  address: string;
  url: string;
  canSave: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const { body, documentElement } = document;
    const mobile = window.matchMedia("(max-width: 1023.98px)");

    const apply = () => {
      if (mobile.matches) {
        const height = node.offsetHeight;
        body.classList.add("has-mobile-cta");
        documentElement.style.setProperty("--mobile-cta-height", `${height}px`);
        body.style.paddingBottom = `calc(var(--compare-tray-height, 0px) + ${height}px + 1rem)`;
      } else {
        body.classList.remove("has-mobile-cta");
        documentElement.style.removeProperty("--mobile-cta-height");
        body.style.removeProperty("padding-bottom");
      }
    };
    apply();
    const observer = new ResizeObserver(apply);
    observer.observe(node);
    mobile.addEventListener("change", apply);

    return () => {
      observer.disconnect();
      mobile.removeEventListener("change", apply);
      body.classList.remove("has-mobile-cta");
      documentElement.style.removeProperty("--mobile-cta-height");
      body.style.removeProperty("padding-bottom");
    };
  }, []);

  async function share() {
    try {
      if (typeof navigator !== "undefined" && navigator.share) {
        await navigator.share({ title: address, url });
        return;
      }
      await navigator.clipboard.writeText(url);
    } catch {
      // Cancelled share sheet / clipboard blocked — ignore.
    }
  }

  function inquire() {
    const node = document.getElementById("property-inquiry");
    node?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <div
      ref={ref}
      className={cn(
        "fixed inset-x-0 z-[110] border-t border-line bg-surface/95 px-3 pt-2.5 backdrop-blur-sm lg:hidden",
        "pb-[max(0.75rem,env(safe-area-inset-bottom))]",
      )}
      style={{ bottom: "var(--compare-tray-height, 0px)" }}
    >
      <div className="mx-auto flex w-full max-w-lg items-center gap-2">
        {canSave && (
          <div className="inline-flex h-11 shrink-0 items-center rounded-control border border-line bg-surface px-2.5">
            <SaveButton listingKey={listingKey} address={address} variant="inline" />
          </div>
        )}
        <button
          type="button"
          onClick={() => void share()}
          className="inline-flex h-11 shrink-0 items-center justify-center rounded-control border border-line bg-surface px-3.5 text-caption font-medium text-ink hover:border-navy hover:text-navy"
        >
          Share
        </button>
        <button
          type="button"
          onClick={inquire}
          className="inline-flex h-11 min-w-0 flex-1 items-center justify-center rounded-control bg-navy px-4 text-caption font-semibold text-white hover:bg-navy-deep"
        >
          Book a viewing
        </button>
      </div>
    </div>
  );
}
