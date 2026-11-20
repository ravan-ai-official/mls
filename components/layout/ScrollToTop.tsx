"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils/cn";

const SHOW_AFTER_PX = 480;

/**
 * Floating control that returns the visitor to the top of the page after they
 * scroll past the first viewport. Sits bottom-left so it clears the assistant.
 */
export function ScrollToTop() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => {
      setVisible(window.scrollY > SHOW_AFTER_PX);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <button
      type="button"
      aria-label="Scroll to top"
      tabIndex={visible ? 0 : -1}
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      className={cn(
        "fixed bottom-6 left-4 z-[55] grid h-11 w-11 place-items-center rounded-control border border-gold/40 bg-gold text-ink shadow-lg ring-1 ring-black/10 transition-all duration-200 hover:bg-gold-deep hover:shadow-xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold sm:left-6",
        visible
          ? "pointer-events-auto translate-y-0 opacity-100"
          : "pointer-events-none translate-y-2 opacity-0",
      )}
    >
      <svg
        width="18"
        height="18"
        viewBox="0 0 18 18"
        fill="none"
        aria-hidden="true"
        focusable="false"
      >
        <path
          d="M9 14.25V3.75M9 3.75L4.5 8.25M9 3.75L13.5 8.25"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );
}
