import Image from "next/image";
import type { ReactNode } from "react";
import { HeroSearch } from "@/components/home/HeroSearch";
import { Eyebrow } from "@/components/ui/Badge";
import { isOptimizableImage } from "@/lib/api/homeMappers";
import { textOf } from "@/lib/site/read";

const DEFAULT_LINES = ["Real Estate,", "Made", "Remarkably", "Smarter."];
const DEFAULT_DESCRIPTION =
  "Search live MLS® listings, discover pre-construction projects, compare communities, and make informed decisions with real market data and trusted local expertise.";

/** The hero layout, without the live freshness line, so the editor preview can render it. */
export function HeroFrame({
  content,
  children,
}: {
  content?: Record<string, unknown>;
  children?: ReactNode;
}) {
  const lines = Array.isArray(content?.lines)
    ? content.lines.filter((line): line is string => typeof line === "string" && line.trim().length > 0)
    : DEFAULT_LINES;
  const heading = lines.length > 0 ? lines : DEFAULT_LINES;
  const accent = typeof content?.accentLine === "number" ? content.accentLine : 3;
  const focalX = typeof content?.focalX === "number" ? content.focalX : 60;
  const scrim = typeof content?.scrim === "number" ? content.scrim : 55;
  const imageUrl = textOf(content, "imageUrl", "/images/hero/hero-bg.jpg");
  const imageAlt = textOf(content, "imageAlt", "");

  return (
    <section className="relative isolate overflow-hidden bg-navy">
      <Image
        src={imageUrl}
        alt={imageAlt}
        fill
        priority
        sizes="100vw"
        quality={85}
        unoptimized={!isOptimizableImage(imageUrl)}
        className="-z-10 object-cover"
        style={{ objectPosition: `${focalX}% center` }}
      />
      <div
        className="absolute inset-0 -z-10"
        style={{ backgroundColor: `rgba(21, 21, 21, ${scrim / 100})` }}
        aria-hidden="true"
      />
      <div
        className="absolute inset-0 -z-10 bg-linear-to-r from-navy-deep/80 via-navy-deep/30 to-transparent"
        aria-hidden="true"
      />
      <div className="container-page flex items-center py-8 sm:min-h-150 sm:py-16 lg:min-h-180 lg:py-20">
        <div className="grid w-full items-center gap-7 sm:gap-10 lg:grid-cols-5 lg:gap-14">
          <div className="lg:col-span-2">
            <Eyebrow>{textOf(content, "eyebrow", "GTA property intelligence")}</Eyebrow>
            <h1 className="mt-3 text-[clamp(2.1rem,1.2rem+4.05vw,4.5rem)] font-semibold leading-[0.95] tracking-[-0.02em] text-white sm:mt-4">
              {heading.map((line, index) => (
                <span key={`${line}-${index}`}>
                  {index > 0 && <br />}
                  {index === accent ? <span className="font-normal text-gold">{line}</span> : line}
                </span>
              ))}
            </h1>
            <p className="mt-4 max-w-md text-body text-white/80 sm:mt-5">
              {textOf(content, "description", DEFAULT_DESCRIPTION)}
            </p>
            {children}
          </div>
          <div className="min-w-0 lg:col-span-3 lg:flex lg:justify-end">
            <HeroSearch content={content} />
          </div>
        </div>
      </div>
    </section>
  );
}
