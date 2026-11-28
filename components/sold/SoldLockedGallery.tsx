"use client";

import { Gallery } from "@/components/property/Gallery";
import { SoldLockedOverlay } from "@/components/sold/SoldLockedOverlay";
import { useSoldLock } from "@/components/sold/useSoldLock";
import type { PropertyImage, PropertyStatus } from "@/lib/types/domain";
import { cn } from "@/lib/utils/cn";

/** Gallery with HouseSigma-style blur + Sign in when sold data is locked. */
export function SoldLockedGallery({
  images,
  address,
  status,
  soldLocked,
}: {
  images: PropertyImage[];
  address: string;
  status: PropertyStatus;
  soldLocked?: boolean;
}) {
  const { locked } = useSoldLock({ soldLocked, status });

  return (
    <div className={cn("relative", locked && "overflow-hidden rounded-surface")}>
      <div className={cn(locked && "pointer-events-none select-none blur-sm scale-[1.02]")}>
        <Gallery images={images} address={address} />
      </div>
      {locked && <SoldLockedOverlay className="rounded-surface" />}
    </div>
  );
}
