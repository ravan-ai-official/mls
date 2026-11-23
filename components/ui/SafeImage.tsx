"use client";

import Image, { type ImageProps } from "next/image";
import { useState } from "react";
import { isOptimizableImage } from "@/lib/api/homeMappers";
import { cn } from "@/lib/utils/cn";

/** Kept for callers that still want an explicit house silhouette. */
export const PLACEHOLDER_IMAGE = "/images/placeholders/home.svg";

type SafeImageProps = Omit<ImageProps, "src"> & {
  /** Missing, empty or broken sources render nothing (layout slot only). */
  src: string | null | undefined;
};

/**
 * `next/image` that never shows a broken-image icon or "no photo" copy.
 *
 * Feed photos (ddfcdn.realtor.ca / trreb-image.ampre.ca) often fail when run
 * through the Next image optimizer on Vercel, so MLS CDNs load `unoptimized`.
 * If an optimized remote still errors once, we retry unoptimized before
 * hiding the image. Failed / missing sources leave a blank surface so cards
 * keep their aspect ratio without fallback text.
 */
export function SafeImage({ src, alt, unoptimized, onError, referrerPolicy, className, ...props }: SafeImageProps) {
  // Remembers WHICH source failed, so a new `src` gets its own attempt.
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  // After an optimizer failure, force a direct browser fetch before giving up.
  const [forceUnoptimized, setForceUnoptimized] = useState(false);
  const usable = src && src !== failedSrc ? src : null;
  const skipOptimize =
    Boolean(unoptimized) ||
    forceUnoptimized ||
    (usable ? !isOptimizableImage(usable) : true);
  // Remount when the URL or optimize mode changes so next/image can't keep a stale bitmap.
  const imageKey = usable ? `${usable}:${skipOptimize ? "raw" : "opt"}` : "empty";

  if (!usable) {
    const { fill, width, height, style } = props;
    if (fill) {
      return (
        <span
          aria-hidden
          className={cn("absolute inset-0 bg-surface-alt", className)}
          style={style}
        />
      );
    }
    return (
      <span
        aria-hidden
        className={cn("block bg-surface-alt", className)}
        style={{
          width: typeof width === "number" ? width : width,
          height: typeof height === "number" ? height : height,
          ...style,
        }}
      />
    );
  }

  return (
    <Image
      {...props}
      key={imageKey}
      src={usable}
      alt={alt}
      className={className}
      unoptimized={skipOptimize}
      // Some board CDNs are picky about Referer; no-referrer is safest for MLS photos.
      referrerPolicy={referrerPolicy ?? (skipOptimize ? "no-referrer" : undefined)}
      onError={(event) => {
        if (!skipOptimize && /^https?:\/\//i.test(usable)) {
          setForceUnoptimized(true);
          return;
        }
        setFailedSrc(usable);
        onError?.(event);
      }}
    />
  );
}
