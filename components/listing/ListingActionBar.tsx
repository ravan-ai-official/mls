"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { InquiryForm } from "@/components/property/InquiryForm";
import { usePreconDocument, type DocumentState } from "@/components/precon/usePreconDocument";
import { Eyebrow } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import type { PreconDocumentType } from "@/lib/api/preconstruction";
import type { PreconDocuments } from "@/lib/precon/parse";
import { trackPreconActivity } from "@/lib/activity/client";
import { cn } from "@/lib/utils/cn";

/**
 * Floor plans / Pricing / Contact agent, for pre-con detail pages only (MLS
 * listing pages keep their InquiryForm).
 *
 * Floor plans and Pricing sit behind the phone gate (sign-in + OTP); the
 * backend enforces the same rule, this only saves the round trip. A document
 * the project doesn't have renders disabled with "Coming soon" — the page
 * learns that from `documents` flags, never from a URL.
 *
 * Renders twice from one state: a panel for the top of the desktop aside and a
 * fixed bottom bar on mobile. The bar stacks above the compare tray (via the
 * body class CompareTray sets) rather than hiding under it.
 */
export function ListingActionBar({
  projectId,
  title,
  documents,
}: {
  projectId: number;
  title: string;
  documents: PreconDocuments;
}) {
  const { open, state, reset } = usePreconDocument(projectId);
  const [contactOpen, setContactOpen] = useState(false);

  function openDocument(type: PreconDocumentType) {
    trackPreconActivity(projectId, type === "floor_plan" ? "floor_plans" : "pricing");
    open(type);
  }

  const buttons = (compact: boolean) => (
    <>
      <DocButton
        type="floor_plan"
        label="Floor plans"
        available={documents.floorPlan}
        state={state}
        onOpen={openDocument}
        compact={compact}
        variant="primary"
        icon={<PlanIcon />}
      />
      <DocButton
        type="price_list"
        label="Pricing"
        available={documents.priceList}
        state={state}
        onOpen={openDocument}
        compact={compact}
        variant="secondary"
        icon={<TagIcon />}
      />
      <Button
        variant="secondary"
        size={compact ? "sm" : "md"}
        block
        onClick={() => {
          trackPreconActivity(projectId, "contact");
          setContactOpen(true);
        }}
        className="border-gold text-ink hover:border-gold hover:bg-gold-soft hover:text-ink"
      >
        <ChatIcon />
        {compact ? "Register" : "Register interest"}
      </Button>
    </>
  );

  return (
    <>
      <div className="hidden space-y-4 lg:block">
        <div className="rounded-surface border border-line bg-surface p-5 shadow-card">
          <Eyebrow>Interested in this project?</Eyebrow>
          <h2 className="mt-2 text-h3 text-ink">Get floor plans and pricing</h2>
          <p className="mt-1 text-caption text-ink-muted">
            Verify your phone once to unlock the developer&rsquo;s documents.
          </p>
          <div className="mt-4 space-y-2.5">{buttons(false)}</div>
          <StatusLine state={state} onDismiss={reset} className="mt-3" />
        </div>
        <InquiryForm listingKey={`precon-${projectId}`} address={title} variant="precon" />
      </div>

      <MobileBar>
        <StatusLine state={state} onDismiss={reset} className="mb-2" />
        <div className="grid grid-cols-3 gap-2">{buttons(true)}</div>
      </MobileBar>

      <Modal
        open={contactOpen}
        onClose={() => setContactOpen(false)}
        title="Register interest"
        description={`Register or enquire about ${title}: releases, pricing and incentives.`}
      >
        <InquiryForm
          listingKey={`precon-${projectId}`}
          address={title}
          variant="precon"
          framed={false}
        />
      </Modal>
    </>
  );
}

function DocButton({
  type,
  label,
  available,
  state,
  onOpen,
  compact,
  variant,
  icon,
}: {
  type: PreconDocumentType;
  label: string;
  available: boolean;
  state: DocumentState;
  onOpen: (type: PreconDocumentType) => void;
  compact: boolean;
  variant: "primary" | "secondary";
  icon: ReactNode;
}) {
  const loading = state.status === "loading" && state.type === type;
  // Rendered in both the aside and the mobile bar, so the id needs a suffix.
  const hintId = `${type}-soon${compact ? "-mobile" : ""}`;
  return (
    <div>
      <Button
        variant={variant}
        size={compact ? "sm" : "md"}
        block
        disabled={!available}
        loading={loading}
        onClick={() => onOpen(type)}
        aria-describedby={!available ? hintId : undefined}
      >
        {!loading && icon}
        {label}
      </Button>
      {!available && (
        <p id={hintId} className="mt-1 text-center text-caption text-ink-subtle">
          Coming soon
        </p>
      )}
    </div>
  );
}

const DOC_NAMES: Record<PreconDocumentType, string> = {
  floor_plan: "floor plans",
  price_list: "price list",
  brochure: "brochure",
};

/** Inline error, or the fallback link when the tab could not be opened in the click. */
function StatusLine({
  state,
  onDismiss,
  className,
}: {
  state: DocumentState;
  onDismiss: () => void;
  className?: string;
}) {
  if (state.status === "error") {
    return (
      <p
        role="alert"
        className={cn(
          "flex items-start justify-between gap-2 rounded-control bg-negative-soft px-3 py-2 text-caption text-negative",
          className,
        )}
      >
        {state.message}
        <DismissButton onClick={onDismiss} />
      </p>
    );
  }
  if (state.status === "ready") {
    return (
      <p
        role="status"
        className={cn(
          "flex items-center justify-between gap-2 rounded-control bg-positive-soft px-3 py-2 text-caption text-positive",
          className,
        )}
      >
        <a
          href={state.url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={onDismiss}
          className="font-semibold underline underline-offset-2"
        >
          Open {DOC_NAMES[state.type]}
        </a>
        <span className="text-ink-muted">Opens in a new tab</span>
      </p>
    );
  }
  return null;
}

function DismissButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Dismiss"
      className="shrink-0 rounded-full p-0.5 hover:bg-negative/10"
    >
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M18 6 6 18M6 6l12 12" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
      </svg>
    </button>
  );
}

/**
 * Fixed bottom bar below `lg`. Reserves its height as body padding (plus the
 * compare tray's, when that is up) so it never covers the footer. The inline
 * style outranks the tray's `body.has-compare-tray` padding, hence the sum.
 */
function MobileBar({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const { body } = document;
    const mobile = window.matchMedia("(max-width: 1023.98px)");

    const apply = () => {
      if (mobile.matches) {
        const height = node.offsetHeight;
        body.classList.add("has-mobile-cta");
        document.documentElement.style.setProperty("--mobile-cta-height", `${height}px`);
        body.style.paddingBottom = `calc(var(--compare-tray-height, 0px) + ${height}px + 1rem)`;
      } else {
        body.classList.remove("has-mobile-cta");
        document.documentElement.style.removeProperty("--mobile-cta-height");
        body.style.removeProperty("padding-bottom");
      }
    };
    apply();
    // --compare-tray-height resolves live in CSS, so only our own height and
    // the breakpoint need watching.
    const observer = new ResizeObserver(apply);
    observer.observe(node);
    mobile.addEventListener("change", apply);

    return () => {
      observer.disconnect();
      mobile.removeEventListener("change", apply);
      body.classList.remove("has-mobile-cta");
      document.documentElement.style.removeProperty("--mobile-cta-height");
      body.style.removeProperty("padding-bottom");
    };
  }, []);

  return (
    <div
      ref={ref}
      role="region"
      aria-label="Project actions"
      className={cn(
        "fixed inset-x-0 bottom-0 z-[110] border-t border-line bg-surface/95 py-2.5 shadow-pop backdrop-blur lg:hidden",
        "[.has-compare-tray_&]:bottom-[var(--compare-tray-height)]",
      )}
    >
      <div className="container-page">{children}</div>
    </div>
  );
}

function PlanIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M3 4h18v16H3zM3 12h7m4 0h7M10 4v5m0 6v5m4-16v4"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function TagIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <circle cx="7.5" cy="7.5" r="1.5" fill="currentColor" />
    </svg>
  );
}

function ChatIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}
