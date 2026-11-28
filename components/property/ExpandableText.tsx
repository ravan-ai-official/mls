"use client";

import { useState } from "react";

/**
 * Long listing copy collapsed behind “Read more” so Overview stays scannable.
 */
export function ExpandableText({
  text,
  maxChars = 420,
  className,
}: {
  text: string;
  maxChars?: number;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const needsCollapse = text.length > maxChars;
  const shown = !needsCollapse || open ? text : `${text.slice(0, maxChars).trimEnd()}…`;

  return (
    <div className={className}>
      <p className="whitespace-pre-line text-[14px] leading-relaxed text-ink-muted">{shown}</p>
      {needsCollapse && (
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          className="mt-2 text-[13px] font-semibold text-navy hover:underline"
          aria-expanded={open}
        >
          {open ? "Show less" : "Read more"}
        </button>
      )}
    </div>
  );
}
