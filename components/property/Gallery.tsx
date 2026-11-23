"use client";

import { SafeImage } from "@/components/ui/SafeImage";
import { useCallback, useEffect, useState } from "react";
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

  const count = images.length;
  useScrollLock(lightbox);

  const go = useCallback(
    (delta: number) => {
      if (count <= 1) return;
      setIndex((current) => (current + delta + count) % count);
    },
    [count],
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
      const target = images[(index + offset + count) % count]?.url;
      if (!target || typeof window === "undefined") continue;
      const preload = new window.Image();
      preload.decoding = "async";
      preload.src = target;
    }
  }, [lightbox, index, count, images]);

  if (count === 0) {
    return (
      <div
        aria-hidden
        className="h-[220px] rounded-surface border border-line bg-surface-alt sm:h-[360px] lg:h-[440px]"
      />
    );
  }

  const current = images[index] ?? images[0];

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
            src={images[0].url}
            alt={`${address} — main photo`}
            fill
            priority
            sizes="(max-width: 640px) 100vw, (max-width: 1280px) 70vw, 900px"
            className="object-cover transition-transform duration-500 hover:scale-[1.02]"
          />
        </button>

        {count > 1 && (
          // A 2×2 thumbnail block, as in HomeAtlasUI: one hero photo with four
          // supporting shots reads as a gallery, where two read as an offcut.
          <div className="hidden h-full grid-cols-2 grid-rows-2 gap-2 sm:grid">
            {images.slice(1, 5).map((image, i) => {
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
          <div className="min-h-0 flex-1">
            <LightboxSlide
              key={`${index}-${current.url}`}
              src={current.url}
              alt={`${address} — photo ${index + 1}`}
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
function LightboxSlide({ src, alt }: { src: string; alt: string }) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const failed = failedSrc === src;

  return (
    <div className="flex h-full min-h-0 w-full items-center justify-center px-4">
      {/* eslint-disable-next-line @next/next/no-img-element -- lightbox needs instant src swaps */}
      {!failed && (
        <img
          key={src}
          src={src}
          alt={alt}
          decoding="async"
          fetchPriority="high"
          referrerPolicy="no-referrer"
          onError={() => setFailedSrc(src)}
          className="h-auto w-auto max-h-full max-w-full object-contain"
        />
      )}
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
