"use client";

import dynamic from "next/dynamic";

/**
 * Lazy-mount the floating assistant so it never blocks first paint or the
 * site chrome. SSR is off — the FAB is client-only interaction.
 */
export const AiAssistantLazy = dynamic(
  () =>
    import("@/components/assistant/AiAssistant").then((mod) => ({
      default: mod.AiAssistant,
    })),
  { ssr: false, loading: () => null },
);
