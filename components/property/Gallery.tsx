"use client";

import { SafeImage } from "@/components/ui/SafeImage";
import { useCallback, useEffect, useMemo, useRef, useState, type TouchEvent } from "react";
import { cn } from "@/lib/utils/cn";
import { useScrollLock } from "@/lib/hooks/useScrollLock";
import type { PropertyImage } from "@/lib/types/domain";

/**
 * Photo gallery with a lightbox.
 *
 * Keyboard: arrows move between photos, Escape closes the lightbox.
 * Lightbox swaps use a keyed <img> (not next/image) so the counter and the
 * visible photo stay in sync — next/image was keeping the previous frame
 * painted while the index advanced.
 */
export function Gallery({
  images,
  address,
}: {
  images: PropertyImage[];
  address: string;
}) {
  const [index, setIndex] = useState(0);
  const [lightbox, setLightbox] = useState(false);
  // URLs that failed to load — drop them so we never keep blank tiles in the set.
  const [failedUrls, setFailedUrls] = useState<Set<string>>(() => new Set());

  const photos = useMemo(
    () => images.filter((image) => image.url && !failedUrls.has(image.url)),
    [images, failedUrls],
  );
  const count = photos.length;
  useScrollLock(lightbox);

  const markFailed = useCallback((url: string) => {
    setFailedUrls((prev) => {
      if (prev.has(url)) return prev;
      const next = new Set(prev);
      next.add(url);
      return next;
    });
  }, []);

  // Keep the lightbox index inside the surviving photo set; close if none left.
  useEffect(() => {
    if (count === 0) {
      setIndex(0);
      setLightbox(false);
      return;
    }
    setIndex((current) => Math.min(current, count - 1));
  }, [count]);

  const go = useCallback(
    (delta: number) => {
      if (count <= 1) return;
      setIndex((current) => (current + delta + count) % count);
    },
    [count],
  );

  const touchStartX = useRef<number | null>(null);

  const onTouchStart = useCallback((event: TouchEvent) => {
    touchStartX.current = event.changedTouches[0]?.clientX ?? null;
  }, []);

  const onTouchEnd = useCallback(
    (event: TouchEvent) => {
      const start = touchStartX.current;
      touchStartX.current = null;
      if (start === null) return;
      const end = event.changedTouches[0]?.clientX;
      if (end === undefined) return;
      const delta = end - start;
      if (Math.abs(delta) < 48) return;
      go(delta < 0 ? 1 : -1);
    },
    [go],
  );

  useEffect(() => {
    if (!lightbox) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setLightbox(false);
      if (event.key === "ArrowRight") {
        event.preventDefault();
        go(1);
      }
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        go(-1);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [lightbox, go]);

  // Warm the neighbours so next/prev paints immediately.
  useEffect(() => {
    if (!lightbox || count <= 1) return;
    for (const offset of [-2, -1, 1, 2]) {
      const target = photos[(index + offset + count) % count]?.url;
      if (!target || typeof window === "undefined") continue;
      const preload = new window.Image();
      preload.decoding = "async";
      preload.src = target;
    }
  }, [lightbox, index, count, photos]);

  // No usable photos — skip the gallery entirely (no blank tiles / placeholders).
  if (count === 0) return null;

  const current = photos[index] ?? photos[0];

  return (
    <>
      <div className="grid gap-2 sm:grid-cols-[2fr_1fr] sm:h-[360px] lg:h-[440px]">
        <button
          type="button"
          onClick={() => {
            setIndex(0);
            setLightbox(true);
          }}
          className="relative h-[220px] overflow-hidden rounded-surface bg-surface-alt sm:h-full"
          aria-label={`View photo 1 of ${count} full screen`}
        >
          <SafeImage
            src={photos[0].url}
            alt={`${address} — main photo`}
            fill
            priority
            sizes="(max-width: 640px) 100vw, (max-width: 1280px) 70vw, 900px"
            className="object-cover transition-transform duration-500 hover:scale-[1.02]"
            onError={() => markFailed(photos[0].url)}
          />
          <span className="absolute bottom-3 left-3 rounded-full bg-ink/75 px-2.5 py-1 text-[12px] font-medium tabular-nums text-white backdrop-blur-sm">
            1 / {count}
          </span>
          {count > 1 && (
            <span className="absolute bottom-3 right-3 rounded-full bg-ink/75 px-2.5 py-1 text-[12px] font-medium text-white backdrop-blur-sm sm:hidden">
              View all photos
            </span>
          )}
        </button>

        {count > 1 && (
          // A 2×2 thumbnail block, as in HomeAtlasUI: one hero photo with four
          // supporting shots reads as a gallery, where two read as an offcut.
          <div className="hidden h-full grid-cols-2 grid-rows-2 gap-2 sm:grid">
            {photos.slice(1, 5).map((image, i) => {
              const shown = Math.min(count - 1, 4);
              const isLast = i === shown - 1;
              const remaining = count - 1 - shown;
              const photoIndex = i + 1;
              return (
                <button
                  key={`${photoIndex}-${image.url}`}
                  type="button"
                  onClick={() => {
                    setIndex(photoIndex);
                    setLightbox(true);
                  }}
                  className="relative min-h-0 overflow-hidden rounded-surface bg-surface-alt"
                  aria-label={
                    isLast && remaining > 0
                      ? `View all ${count} photos full screen`
                      : `View photo ${photoIndex + 1} of ${count} full screen`
                  }
                >
                  <SafeImage
                    src={image.url}
                    alt={`${address} — photo ${photoIndex + 1}`}
                    fill
                    sizes="(max-width: 1280px) 30vw, 320px"
                    className="object-cover transition-transform duration-500 hover:scale-[1.02]"
                    onError={() => markFailed(image.url)}
                  />
                  {isLast && remaining > 0 && (
                    <span className="absolute inset-0 flex items-center justify-center bg-ink/55 text-small font-semibold text-white">
                      +{remaining} more
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {lightbox && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Photo ${index + 1} of ${count} for ${address}`}
          className="fixed inset-0 z-[250] flex h-dvh max-h-dvh flex-col overflow-hidden bg-ink/95"
        >
          <div className="flex shrink-0 items-center justify-between px-5 py-4 text-white">
            <p className="text-small tabular-nums">
              {index + 1} / {count}
            </p>
            <button
              type="button"
              onClick={() => setLightbox(false)}
              className="rounded-full p-2 transition-colors hover:bg-white/10"
              aria-label="Close gallery"
              autoFocus
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M18 6 6 18M6 6l12 12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
            </button>
          </div>

          {/* min-h-0 is required so the flex child can shrink below the image's
              intrinsic height — otherwise tall flyers push the nav off-screen. */}
          <div
            className="min-h-0 flex-1 touch-pan-y"
            onTouchStart={onTouchStart}
            onTouchEnd={onTouchEnd}
          >
            <LightboxSlide
              key={`${index}-${current.url}`}
              src={current.url}
              alt={`${address} — photo ${index + 1}`}
              onUnavailable={() => markFailed(current.url)}
            />
          </div>

          {count > 1 && (
            <div className="flex shrink-0 items-center justify-between px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3">
              <GalleryNav label="Previous photo" onClick={() => go(-1)} direction="left" />
              <GalleryNav label="Next photo" onClick={() => go(1)} direction="right" />
            </div>
          )}
        </div>
      )}
    </>
  );
}

/**
 * Native <img> keyed per slide. Avoids next/image holding the previous bitmap
 * while a new remote listing photo streams in.
 */
function LightboxSlide({
  src,
  alt,
  onUnavailable,
}: {
  src: string;
  alt: string;
  onUnavailable?: () => void;
}) {
  return (
    <div className="flex h-full min-h-0 w-full items-center justify-center px-4">
      {/* eslint-disable-next-line @next/next/no-img-element -- lightbox needs instant src swaps */}
      <img
        key={src}
        src={src}
        alt={alt}
        decoding="async"
        fetchPriority="high"
        referrerPolicy="no-referrer"
        onError={() => onUnavailable?.()}
        className="h-auto w-auto max-h-full max-w-full object-contain"
      />
    </div>
  );
}

function GalleryNav({
  label,
  onClick,
  direction,
}: {
  label: string;
  onClick: () => void;
  direction: "left" | "right";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={cn(
        "flex h-11 w-11 items-center justify-center rounded-full border border-white/25 bg-ink/40 text-white backdrop-blur-sm",
        "transition-colors hover:bg-white/10",
      )}
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          d={direction === "left" ? "M15 5l-7 7 7 7" : "M9 5l7 7-7 7"}
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );
}
