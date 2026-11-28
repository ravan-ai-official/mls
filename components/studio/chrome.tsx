import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

/**
 * Shared chrome for the admin console. Every screen uses the same header,
 * filters, tables, and empty states so the console reads as one tool.
 */

export function StudioPage({
  kicker,
  title,
  description,
  meta,
  actions,
  toolbar,
  filters,
  note,
  children,
  className,
}: {
  kicker?: string;
  title: string;
  description?: string;
  meta?: ReactNode;
  actions?: ReactNode;
  /** Primary CTAs on the title row (e.g. New post). */
  toolbar?: ReactNode;
  /** Filter chips / search row under the title (Vercel-style). */
  filters?: ReactNode;
  /** Status line that stays with the title, above the page content. */
  note?: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  const showDescription = Boolean(description) && !filters && !toolbar;

  return (
    <div className={cn("space-y-3", className)}>
      <header className="space-y-3 border-b border-line pb-3">
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <div className="min-w-0">
            {kicker ? (
              <p className="text-[0.6875rem] font-medium uppercase tracking-wide text-ink-muted">{kicker}</p>
            ) : null}
            <div className={cn("flex flex-wrap items-center gap-x-3 gap-y-1", kicker && "mt-0.5")}>
              <h1 className="text-h1 text-ink">{title}</h1>
              {meta}
            </div>
            {showDescription ? <p className="mt-1 max-w-3xl text-small text-ink-muted">{description}</p> : null}
          </div>
          {toolbar || actions ? (
            <div className="flex shrink-0 flex-wrap items-center gap-2">{toolbar ?? actions}</div>
          ) : null}
        </div>
        {description && (filters || toolbar) ? (
          <p className="text-caption text-ink-muted">{description}</p>
        ) : null}
        {filters ? <StudioFilterBar>{filters}</StudioFilterBar> : null}
        {note ? <div>{note}</div> : null}
      </header>
      {children}
    </div>
  );
}

export function StudioToolbar({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("flex shrink-0 flex-wrap items-center justify-end gap-2", className)}>{children}</div>;
}

export function StudioFilterBar({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("flex flex-wrap items-center gap-2", className)}>{children}</div>;
}

/** Dashed chip matching dense deployment-style filter pills. */
export function StudioFilterChip({
  label,
  value,
  onClear,
}: {
  label: string;
  value: string;
  onClear?: () => void;
}) {
  return (
    <span className="inline-flex h-8 max-w-full items-center gap-1.5 rounded-full border border-dashed border-line bg-surface px-2.5 text-caption text-ink">
      <span className="shrink-0 text-ink-muted">{label}:</span>
      <span className="min-w-0 truncate font-medium">{value}</span>
      {onClear ? (
        <button
          type="button"
          onClick={onClear}
          className="ml-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full text-ink-subtle hover:bg-surface-alt hover:text-ink"
          aria-label={`Clear ${label} filter`}
        >
          ×
        </button>
      ) : null}
    </span>
  );
}

export function StudioBack({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="inline-flex items-center gap-1.5 text-caption font-medium text-ink-muted hover:text-navy">
      <span aria-hidden="true">←</span>
      {children}
    </Link>
  );
}

export function StudioAlert({ children }: { children: ReactNode }) {
  return (
    <p role="alert" className="rounded-control border border-negative/25 bg-negative-soft px-3.5 py-2.5 text-small text-ink">
      {children}
    </p>
  );
}

export function StudioEmpty({
  title,
  children,
  action,
}: {
  title: string;
  children?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="border border-dashed border-line bg-surface px-6 py-10 text-center">
      <h2 className="text-h3 text-ink">{title}</h2>
      {children ? <p className="mx-auto mt-1.5 max-w-md text-small text-ink-muted">{children}</p> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

export function StudioPanel({
  title,
  description,
  action,
  children,
  className,
}: {
  title?: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("border border-line bg-surface p-4 sm:p-5", className)}>
      {title || action ? (
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            {title ? <h2 className="text-h3 text-ink">{title}</h2> : null}
            {description ? <p className="mt-1 text-small text-ink-muted">{description}</p> : null}
          </div>
          {action}
        </div>
      ) : null}
      <div className={title || action ? "mt-3" : undefined}>{children}</div>
    </section>
  );
}

export function StudioSegment({ label, children }: { label: string; children: ReactNode }) {
  return (
    <nav aria-label={label} className="flex flex-wrap gap-0.5 rounded-control border border-line bg-surface p-0.5">
      {children}
    </nav>
  );
}

export function segmentItem(active: boolean) {
  return cn(
    "rounded-[0.45rem] px-2.5 py-1.5 text-caption font-medium transition-colors",
    active ? "bg-navy text-white" : "text-ink-muted hover:bg-surface-alt hover:text-ink",
  );
}

/** Compact select used in page toolbars. */
export const studioFilter =
  "h-8 shrink-0 rounded-full border border-dashed border-line bg-surface px-2.5 text-caption text-ink focus:border-navy/35 focus:outline-none focus:ring-2 focus:ring-navy/10";

export const studioSearch =
  "h-8 w-full rounded-full border border-line bg-surface px-3 text-caption text-ink placeholder:text-ink-subtle focus:border-navy/35 focus:outline-none focus:ring-2 focus:ring-navy/10 sm:w-52";

export const studioTableWrap = "overflow-x-auto border-y border-line bg-surface -mx-3 sm:-mx-4 lg:-mx-5";

export const studioTable = "w-full border-collapse text-left text-small";

export const studioTh =
  "border-b border-line px-3 py-2 text-caption font-medium text-ink-muted sm:px-4";

export const studioTd = "border-b border-line/60 px-3 py-2 align-middle sm:px-4";

/** Horizontal bleed that matches the shell's main padding. */
export const studioCanvasBleed = "-mx-3 px-3 sm:-mx-4 sm:px-4 lg:-mx-5 lg:px-5";

/** Pulls a bar flush with the scrolling canvas. */
export const studioStickyTop = `sticky top-0 z-20 -mt-5 border-b border-line bg-surface-alt/95 backdrop-blur-md sm:-mt-6 lg:-mt-6 ${studioCanvasBleed}`;
