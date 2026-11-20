"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import { SafeImage } from "@/components/ui/SafeImage";
import { useAuth } from "@/components/providers/AuthProvider";
import { MARKET_CITIES, type RecentSale } from "@/lib/api/market";
import { properties as sampleProperties, formatFullPrice } from "@/lib/home/sampleData";
import { useSubmitInquiry } from "@/lib/queries/inquiries";
import { useRecentSales } from "@/lib/queries/market";
import { formatDate, formatNumber, formatPrice } from "@/lib/utils/format";
import { propertyPath } from "@/lib/seo/urls";
import { cn } from "@/lib/utils/cn";

const SAMPLE_SOLD = sampleProperties.filter((p) => p.status === "sold").slice(0, 6);

function minBedsOrBaths(raw: string): number | undefined {
  const cleaned = raw.replace("+", "").trim();
  if (!cleaned) return undefined;
  const parsed = Number.parseInt(cleaned, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

const inputClass =
  "w-full rounded-lg border border-line bg-surface px-4 py-3 text-small text-ink placeholder:text-ink-subtle transition focus:outline-none focus:ring-2 focus:ring-navy";
const selectClass = `${inputClass} appearance-none`;
const labelClass = "mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-ink-muted";

function splitName(full: string) {
  const [first = "", ...rest] = full.trim().split(/\s+/);
  return { first_name: first || "Seller", last_name: rest.join(" ") };
}

function cityFromAddress(address: string): string {
  const lower = address.toLowerCase();
  const hit = MARKET_CITIES.find((city) => lower.includes(city.toLowerCase()));
  return hit ?? "Toronto";
}

function soldOverAsk(sold: number, list: number): string {
  const pct = ((sold - list) / list) * 100;
  if (pct > 0) return `+${pct.toFixed(1)}% over ask`;
  if (pct < 0) return `${pct.toFixed(1)}% under ask`;
  return "At asking";
}

function IconChevronRight() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M9 18l6-6-6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function SelectChevron() {
  return (
    <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-ink-subtle">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
}

function ServiceCard({ icon, title, description }: { icon: ReactNode; title: string; description: string }) {
  return (
    <div className="flex flex-col gap-4 rounded-xl border border-line bg-surface p-6 shadow-card transition-shadow hover:shadow-md">
      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gold-soft text-gold">{icon}</div>
      <div>
        <h3 className="mb-1 text-body font-bold text-ink">{title}</h3>
        <p className="text-small leading-relaxed text-ink-muted">{description}</p>
      </div>
    </div>
  );
}

function SampleSoldCard({ property }: { property: (typeof SAMPLE_SOLD)[number] }) {
  const ratio =
    property.soldPrice && property.price
      ? ((property.soldPrice - property.price) / property.price) * 100
      : 0;
  const isOverAsk = ratio >= 0;
  return (
    <div className="overflow-hidden rounded-xl border border-line bg-surface shadow-card">
      <div className="relative h-44 overflow-hidden">
        <SafeImage src={property.image} alt={property.address} fill className="object-cover" sizes="(max-width:768px) 100vw, 33vw" />
        {property.soldDate ? (
          <span className="absolute left-3 top-3 rounded bg-navy px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-white">
            Sold {formatDate(property.soldDate)}
          </span>
        ) : null}
        {property.soldPrice && property.price ? (
          <span
            className={cn(
              "absolute right-3 top-3 rounded px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-white",
              isOverAsk ? "bg-gold" : "bg-ink-soft",
            )}
          >
            {soldOverAsk(property.soldPrice, property.price)}
          </span>
        ) : null}
      </div>
      <div className="p-4">
        <p className="text-small font-semibold leading-tight text-ink">{property.address}</p>
        <p className="mb-3 text-caption text-ink-muted">
          {property.neighbourhood}, {property.community}
        </p>
        <div className="mb-3 flex items-center justify-between">
          <div>
            <p className="mb-0.5 text-[10px] uppercase tracking-wide text-ink-subtle">Sold price</p>
            <p className="text-body font-bold text-navy">
              {property.soldPrice ? formatFullPrice(property.soldPrice) : "—"}
            </p>
          </div>
          <div className="text-right">
            <p className="mb-0.5 text-[10px] uppercase tracking-wide text-ink-subtle">Listed</p>
            <p className="text-small text-ink-muted line-through">{formatFullPrice(property.price)}</p>
          </div>
        </div>
        <div className="flex items-center gap-3 border-t border-line pt-3 text-caption text-ink-muted">
          <span>{property.beds} bd</span>
          <span>{property.baths} ba</span>
          <span>{property.sqft.toLocaleString("en-CA")} sqft</span>
          <span className="ml-auto text-[10px] text-ink-subtle">{property.type}</span>
        </div>
      </div>
    </div>
  );
}

function LiveSoldCard({ sale }: { sale: RecentSale }) {
  const over = sale.overUnderAskingPct;
  const isOverAsk = over === null || over >= 0;
  const href = sale.listingKey ? propertyPath(sale.listingKey) : null;
  const body = (
    <>
      <div className="mb-3 flex items-start justify-between gap-2">
        {sale.closeDate ? (
          <span className="rounded bg-navy px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-white">
            Sold {formatDate(sale.closeDate)}
          </span>
        ) : (
          <span />
        )}
        {over !== null ? (
          <span
            className={cn(
              "rounded px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-white",
              isOverAsk ? "bg-gold" : "bg-ink-soft",
            )}
          >
            {over > 0 ? `+${over.toFixed(1)}% over ask` : over < 0 ? `${over.toFixed(1)}% under ask` : "At asking"}
          </span>
        ) : null}
      </div>
      <p className="text-small font-semibold leading-tight text-ink group-hover:text-navy">{sale.address}</p>
      <p className="mb-3 text-caption text-ink-muted">{sale.city}</p>
      <div className="mb-3 flex items-center justify-between">
        <div>
          <p className="mb-0.5 text-[10px] uppercase tracking-wide text-ink-subtle">Sold price</p>
          <p className="text-body font-bold text-navy">{formatPrice(sale.closePrice)}</p>
        </div>
        <div className="text-right">
          <p className="mb-0.5 text-[10px] uppercase tracking-wide text-ink-subtle">Listed</p>
          <p className="text-small text-ink-muted line-through">
            {sale.listPrice ? formatPrice(sale.listPrice) : "—"}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-3 border-t border-line pt-3 text-caption text-ink-muted">
        <span>{sale.beds ?? "—"} bd</span>
        <span>{sale.baths ?? "—"} ba</span>
        {sale.daysOnMarket !== null ? <span>{formatNumber(sale.daysOnMarket)} DOM</span> : null}
        <span className="ml-auto text-[10px] text-ink-subtle">{sale.propertyType ?? ""}</span>
      </div>
    </>
  );

  const className =
    "group block overflow-hidden rounded-xl border border-line bg-surface p-4 shadow-card transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy";

  if (!href) {
    return <div className={className}>{body}</div>;
  }
  return (
    <Link href={href} className={className}>
      {body}
    </Link>
  );
}

export function SellPageClient() {
  const { user, openAuth } = useAuth();
  const submitInquiry = useSubmitInquiry();

  const [address, setAddress] = useState("");
  const [propertyType, setPropertyType] = useState("");
  const [beds, setBeds] = useState("");
  const [baths, setBaths] = useState("");
  const [garage, setGarage] = useState("");
  const [lotWidth, setLotWidth] = useState("");
  const [compsVisible, setCompsVisible] = useState(false);
  const [soldUnlocked, setSoldUnlocked] = useState(false);

  const [formName, setFormName] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formPhone, setFormPhone] = useState("");
  const [formAddress, setFormAddress] = useState("");
  const [formPropertyType, setFormPropertyType] = useState("");
  const [formValueRange, setFormValueRange] = useState("");
  const [formBestTime, setFormBestTime] = useState("");
  const [formMessage, setFormMessage] = useState("");
  const [formSubmitted, setFormSubmitted] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [sidebarName, setSidebarName] = useState("");
  const [sidebarPhone, setSidebarPhone] = useState("");
  const [sidebarEmail, setSidebarEmail] = useState("");
  const [sidebarSubmitted, setSidebarSubmitted] = useState(false);
  const [sidebarError, setSidebarError] = useState<string | null>(null);

  const [asgName, setAsgName] = useState("");
  const [asgEmail, setAsgEmail] = useState("");
  const [asgPhone, setAsgPhone] = useState("");
  const [asgProject, setAsgProject] = useState("");
  const [asgUnit, setAsgUnit] = useState("");
  const [asgAskingPrice, setAsgAskingPrice] = useState("");
  const [asgClosingDate, setAsgClosingDate] = useState("");
  const [asgMessage, setAsgMessage] = useState("");
  const [asgSubmitted, setAsgSubmitted] = useState(false);
  const [asgError, setAsgError] = useState<string | null>(null);

  const formRef = useRef<HTMLElement>(null);
  const compsRef = useRef<HTMLElement>(null);
  const assignmentRef = useRef<HTMLElement>(null);

  const compsCity = useMemo(() => cityFromAddress(address || formAddress), [address, formAddress]);
  const compsFilters = useMemo(
    () => ({
      propertyType: propertyType || undefined,
      bedsMin: minBedsOrBaths(beds),
      bathsMin: minBedsOrBaths(baths),
    }),
    [propertyType, beds, baths],
  );
  const salesQuery = useRecentSales(compsCity, 90, 1, compsFilters);
  const liveSales = (salesQuery.data?.results ?? []).slice(0, 6);

  useEffect(() => {
    if (user) setSoldUnlocked(true);
  }, [user]);

  function handleSeeComps() {
    setCompsVisible(true);
    window.setTimeout(() => compsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 80);
  }

  function handleGetAnalysis() {
    setFormAddress(address || formAddress);
    window.setTimeout(() => formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 80);
  }

  function scrollToAssignment() {
    assignmentRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function scrollToAssignmentForm() {
    document.getElementById("assignment-form-anchor")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function handleSidebarSubmit(event: FormEvent) {
    event.preventDefault();
    setSidebarError(null);
    try {
      const names = splitName(sidebarName);
      await submitInquiry.mutateAsync({
        ...names,
        email: sidebarEmail.trim(),
        phone: sidebarPhone.trim(),
        intent: "sell",
        message: [
          "Sell page — free home valuation request.",
          address ? `Property: ${address}` : null,
          propertyType ? `Type: ${propertyType}` : null,
          beds ? `Beds: ${beds}` : null,
          baths ? `Baths: ${baths}` : null,
          garage ? `Garage: ${garage}` : null,
          lotWidth ? `Lot width: ${lotWidth} ft` : null,
        ]
          .filter(Boolean)
          .join("\n"),
        preferred_locations: compsCity,
        page_url: typeof window !== "undefined" ? window.location.href : undefined,
        listing_key: "",
      });
      setSidebarSubmitted(true);
    } catch (caught) {
      setSidebarError(caught instanceof Error ? caught.message : "Could not send your request.");
    }
  }

  async function handleFormSubmit(event: FormEvent) {
    event.preventDefault();
    setFormError(null);
    try {
      const names = splitName(formName);
      await submitInquiry.mutateAsync({
        ...names,
        email: formEmail.trim(),
        phone: formPhone.trim(),
        intent: "sell",
        message: [
          "Sell page — free market analysis.",
          `Property: ${formAddress.trim()}`,
          formPropertyType ? `Type: ${formPropertyType}` : null,
          formValueRange ? `Estimated value: ${formValueRange}` : null,
          formBestTime ? `Best time: ${formBestTime}` : null,
          formMessage.trim() || null,
        ]
          .filter(Boolean)
          .join("\n"),
        preferred_locations: cityFromAddress(formAddress),
        page_url: typeof window !== "undefined" ? window.location.href : undefined,
        listing_key: "",
      });
      setFormSubmitted(true);
    } catch (caught) {
      setFormError(caught instanceof Error ? caught.message : "Could not send your request.");
    }
  }

  async function handleAssignmentSubmit(event: FormEvent) {
    event.preventDefault();
    setAsgError(null);
    try {
      const names = splitName(asgName);
      await submitInquiry.mutateAsync({
        ...names,
        email: asgEmail.trim(),
        phone: asgPhone.trim(),
        intent: "sell",
        message: [
          "[Preconstruction assignment inquiry]",
          `Project: ${asgProject.trim()}`,
          `Unit: ${asgUnit.trim()}`,
          `Asking price: ${asgAskingPrice.trim()}`,
          asgClosingDate.trim() ? `Closing / occupancy: ${asgClosingDate.trim()}` : null,
          asgMessage.trim() || null,
        ]
          .filter(Boolean)
          .join("\n"),
        preferred_locations: "",
        page_url: typeof window !== "undefined" ? window.location.href : undefined,
        listing_key: "",
      });
      setAsgSubmitted(true);
    } catch (caught) {
      setAsgError(caught instanceof Error ? caught.message : "Could not send your request.");
    }
  }

  const showLiveComps = compsVisible && Boolean(user) && soldUnlocked;
  const showAuthGate = compsVisible && !user;

  return (
    <div className="min-h-screen bg-surface-alt">
      <button
        type="button"
        onClick={scrollToAssignment}
        className="fixed bottom-24 right-5 z-50 flex items-center gap-2.5 rounded-full border border-gold/30 bg-navy px-5 py-3.5 text-caption font-bold uppercase tracking-widest text-gold shadow-2xl transition hover:bg-navy-deep active:scale-95 sm:bottom-28"
        aria-label="Jump to Preconstruction Assignment section"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M9 22V12h6v10" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        Preconstruction Assignment
      </button>

      {/* Hero */}
      <section className="bg-navy px-4 pb-20 pt-16">
        <div className="mx-auto max-w-3xl text-center">
          <span className="mb-4 inline-block text-caption font-semibold uppercase tracking-widest text-gold">
            HomeAtlas GTA · Seller Services
          </span>
          <h1 className="mb-4 text-4xl font-bold leading-tight text-white md:text-5xl">
            Sell Your Home <span className="text-gold">Smarter</span>
          </h1>
          <p className="mx-auto mb-10 max-w-xl text-lg text-white/70">
            Get a data-backed market analysis, full MLS exposure, and expert negotiation — all tailored
            to your GTA neighbourhood.
          </p>

          <div className="rounded-2xl bg-surface p-6 text-left shadow-xl md:p-8">
            <h2 className="mb-5 text-body font-bold text-ink">Enter Your Property Details</h2>
            <div className="mb-4 grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="md:col-span-2">
                <label className={labelClass}>Property Address</label>
                <input
                  type="text"
                  placeholder="e.g. 91 Sherwood Ave, Toronto, ON"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>Property Type</label>
                <div className="relative">
                  <select value={propertyType} onChange={(e) => setPropertyType(e.target.value)} className={selectClass}>
                    <option value="">Select type</option>
                    <option>Detached</option>
                    <option>Semi-Detached</option>
                    <option>Townhome</option>
                    <option>Condo</option>
                    <option>Luxury</option>
                  </select>
                  <SelectChevron />
                </div>
              </div>
              <div>
                <label className={labelClass}>Bedrooms</label>
                <div className="relative">
                  <select value={beds} onChange={(e) => setBeds(e.target.value)} className={selectClass}>
                    <option value="">Select</option>
                    <option>1</option>
                    <option>2</option>
                    <option>3</option>
                    <option>4</option>
                    <option>5+</option>
                  </select>
                  <SelectChevron />
                </div>
              </div>
              <div>
                <label className={labelClass}>Bathrooms</label>
                <div className="relative">
                  <select value={baths} onChange={(e) => setBaths(e.target.value)} className={selectClass}>
                    <option value="">Select</option>
                    <option>1</option>
                    <option>2</option>
                    <option>3</option>
                    <option>4</option>
                    <option>5+</option>
                  </select>
                  <SelectChevron />
                </div>
              </div>
              <div>
                <label className={labelClass}>Garage</label>
                <div className="relative">
                  <select value={garage} onChange={(e) => setGarage(e.target.value)} className={selectClass}>
                    <option value="">Select</option>
                    <option>None</option>
                    <option>1-car</option>
                    <option>2-car</option>
                    <option>3-car</option>
                  </select>
                  <SelectChevron />
                </div>
              </div>
              <div>
                <label className={labelClass}>Lot Width (ft)</label>
                <input
                  type="text"
                  placeholder="e.g. 40"
                  value={lotWidth}
                  onChange={(e) => setLotWidth(e.target.value)}
                  className={inputClass}
                />
              </div>
            </div>
            <button
              type="button"
              onClick={handleSeeComps}
              className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-navy px-6 py-4 text-small font-bold uppercase tracking-wide text-gold transition hover:bg-navy-deep active:scale-[0.99]"
            >
              See Last 3 Months Sold Homes Comparable in Your Neighbourhood
              <IconChevronRight />
            </button>
          </div>
        </div>
      </section>

      {/* Two-column body */}
      <div className="mx-auto flex max-w-[1400px] items-start gap-10 px-4 lg:px-10">
        <aside className="sticky top-24 hidden w-[280px] shrink-0 flex-col gap-0 py-14 xl:flex">
          <div className="overflow-hidden rounded-2xl border border-line bg-surface shadow-lg">
            <div className="bg-navy px-5 py-4">
              <p className="mb-0.5 text-[10px] font-bold uppercase tracking-widest text-gold">Free · No Obligation</p>
              <h3 className="text-body font-bold leading-tight text-white">Get Your Home Value</h3>
              <p className="mt-1 text-caption text-white/60">A HomeAtlas advisor replies within 24 hrs</p>
            </div>
            {sidebarSubmitted ? (
              <div className="px-5 py-8 text-center">
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-gold-soft">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path d="M20 6L9 17l-5-5" stroke="#c7a45a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
                <p className="mb-1 text-small font-bold text-navy">Got it!</p>
                <p className="text-caption leading-relaxed text-ink-muted">
                  Our team will be in touch shortly with your complimentary valuation.
                </p>
              </div>
            ) : (
              <form onSubmit={handleSidebarSubmit} className="flex flex-col gap-3 px-5 py-5">
                <div>
                  <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-ink-muted">Your Name *</label>
                  <input required type="text" placeholder="Jane Smith" value={sidebarName} onChange={(e) => setSidebarName(e.target.value)} className={inputClass} />
                </div>
                <div>
                  <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-ink-muted">Phone Number *</label>
                  <input required type="tel" placeholder="(416) 555-0100" value={sidebarPhone} onChange={(e) => setSidebarPhone(e.target.value)} className={inputClass} />
                </div>
                <div>
                  <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-ink-muted">Email *</label>
                  <input required type="email" placeholder="jane@email.com" value={sidebarEmail} onChange={(e) => setSidebarEmail(e.target.value)} className={inputClass} />
                </div>
                {sidebarError ? <p className="text-caption text-negative">{sidebarError}</p> : null}
                <button
                  type="submit"
                  disabled={submitInquiry.isPending}
                  className="mt-1 flex w-full items-center justify-center gap-1.5 rounded-xl bg-gold py-3 text-caption font-bold uppercase tracking-widest text-navy transition hover:bg-gold-deep active:scale-[0.99] disabled:opacity-60"
                >
                  Request Free Valuation
                  <IconChevronRight />
                </button>
                <p className="text-center text-[10px] leading-relaxed text-ink-subtle">No spam. No obligation. Cancel anytime.</p>
              </form>
            )}
            <div className="flex flex-col gap-2 border-t border-line px-5 py-4">
              {["Licensed TRREB Member", "103% Avg. Sale-to-Ask Ratio", "500+ GTA Homes Sold"].map((badge) => (
                <div key={badge} className="flex items-center gap-2 text-[11px] text-ink-muted">
                  <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-gold-soft">
                    <svg width="9" height="9" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <path d="M20 6L9 17l-5-5" stroke="#c7a45a" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </span>
                  {badge}
                </div>
              ))}
            </div>
          </div>
        </aside>

        <div className="min-w-0 flex-1">
          {/* Sold comps */}
          <section ref={compsRef} className="scroll-mt-24 py-14">
            <div className="mb-8 flex items-end justify-between gap-4">
              <div>
                <span className="text-caption font-semibold uppercase tracking-widest text-gold">
                  Comparable Sales · Last 3 Months
                </span>
                <h2 className="mt-1 text-2xl font-bold text-ink md:text-3xl">Recently Sold in Your Area</h2>
              </div>
              <span className="hidden items-center gap-1 text-small text-ink-muted md:flex">
                <span className="inline-block h-3 w-3 rounded-full bg-gold" />
                Over asking
                <span className="ml-3 inline-block h-3 w-3 rounded-full bg-ink-soft" />
                Under asking
              </span>
            </div>

            {!compsVisible ? (
              <div className="rounded-2xl border border-line bg-surface p-10 text-center shadow-card">
                <p className="text-small text-ink-muted">
                  Enter your address above and click the button to reveal comparable sold homes in your
                  neighbourhood.
                </p>
              </div>
            ) : showLiveComps ? (
              salesQuery.isPending ? (
                <p className="text-small text-ink-muted">Loading sold comparables for {compsCity}…</p>
              ) : liveSales.length === 0 ? (
                <div className="rounded-2xl border border-line bg-surface p-10 text-center shadow-card">
                  <p className="text-small text-ink-muted">
                    No closed sales found for {compsCity}
                    {propertyType ? ` · ${propertyType}` : ""}
                    {beds ? ` · ${beds}+ beds` : ""}
                    {baths ? ` · ${baths}+ baths` : ""} in the last 90 days. Widen a filter, try a nearby
                    city, or{" "}
                    <Link href="/recently-sold" className="font-semibold text-navy underline">
                      browse recently sold
                    </Link>
                    .
                  </p>
                </div>
              ) : (
                <div
                  className={cn(
                    "grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3",
                    salesQuery.isPlaceholderData && "opacity-60 transition-opacity",
                  )}
                >
                  {liveSales.map((sale) => (
                    <LiveSoldCard key={sale.listingKey} sale={sale} />
                  ))}
                </div>
              )
            ) : showAuthGate ? (
              <div className="relative">
                <div className="pointer-events-none grid select-none grid-cols-1 gap-5 opacity-50 blur-sm md:grid-cols-2 lg:grid-cols-3">
                  {SAMPLE_SOLD.map((prop) => (
                    <SampleSoldCard key={prop.id} property={prop} />
                  ))}
                </div>
                <div className="absolute inset-0 flex flex-col items-center justify-center rounded-2xl bg-surface/70 backdrop-blur-sm">
                  <div className="max-w-sm rounded-2xl border border-gold/30 bg-surface px-8 py-8 text-center shadow-xl">
                    <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-gold-soft">
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                        <rect x="3" y="11" width="18" height="11" rx="2" stroke="#c7a45a" strokeWidth="1.75" />
                        <path d="M7 11V7a5 5 0 0110 0v4" stroke="#c7a45a" strokeWidth="1.75" strokeLinecap="round" />
                      </svg>
                    </div>
                    <h3 className="mb-1 text-body font-bold text-ink">Sign In to View Sold Data</h3>
                    <p className="mb-5 text-small leading-relaxed text-ink-muted">
                      Past sale prices are available to registered HomeAtlas members.
                    </p>
                    <button
                      type="button"
                      onClick={() => openAuth("signup")}
                      className="flex w-full items-center justify-center gap-2 rounded-xl bg-navy py-3 text-small font-bold text-white transition hover:bg-navy-deep"
                    >
                      Sign In / Register — Free
                    </button>
                  </div>
                </div>
              </div>
            ) : null}
          </section>

          {/* Why Sell */}
          <section className="mb-0 rounded-3xl bg-ink px-8 py-14">
            <div className="mb-10 text-center">
              <span className="text-caption font-semibold uppercase tracking-widest text-gold">Our Advantage</span>
              <h2 className="mt-2 text-3xl font-bold text-white md:text-4xl">Why Sell with HomeAtlas</h2>
              <p className="mx-auto mt-3 max-w-xl text-small leading-relaxed text-white/60">
                We combine local market expertise with cutting-edge technology so your home sells faster,
                for more money.
              </p>
            </div>
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
              <ServiceCard
                icon={
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M9 22V12h6v10" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                }
                title="Full MLS Exposure"
                description="Your listing reaches every active buyer through TRREB MLS, Realtor.ca, and our exclusive HomeAtlas network — maximum visibility from day one."
              />
              <ServiceCard
                icon={
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.75" />
                    <path d="M12 7v5l3 3" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                }
                title="Data-Driven Pricing"
                description="Our proprietary algorithm analyzes thousands of recent comparable sales to position your home at the optimal price point — not too high, not too low."
              />
              <ServiceCard
                icon={
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
                    <circle cx="9" cy="7" r="4" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                }
                title="Expert Negotiation"
                description="Our agents have a proven track record of negotiating 103% of asking price on average. We protect your interests at every step of the transaction."
              />
              <ServiceCard
                icon={
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                }
                title="VIP Network"
                description="Tap into our private database of pre-qualified buyers and investor clients who are actively looking for homes just like yours in the GTA."
              />
            </div>
            <div className="mt-8 flex flex-col items-center justify-between gap-6 rounded-2xl bg-gold p-8 md:flex-row">
              <div>
                <p className="mb-1 text-caption font-bold uppercase tracking-widest text-navy">Proven Results</p>
                <h3 className="text-xl font-bold leading-tight text-navy md:text-2xl">
                  Ready to Sell? Our Team Achieves
                  <br />
                  <span className="text-3xl md:text-4xl">103% of Asking</span> on Average
                </h3>
              </div>
              <button
                type="button"
                onClick={handleGetAnalysis}
                className="flex shrink-0 items-center gap-2 whitespace-nowrap rounded-xl bg-navy px-7 py-3.5 text-small font-bold uppercase tracking-wide text-white transition hover:bg-navy-deep active:scale-[0.98]"
              >
                Get Free Analysis
                <IconChevronRight />
              </button>
            </div>
          </section>

          {/* Seller form */}
          <section ref={formRef} className="scroll-mt-24 py-16">
            <div className="mb-10 text-center">
              <span className="text-caption font-semibold uppercase tracking-widest text-gold">No Obligation</span>
              <h2 className="mt-2 text-3xl font-bold text-ink">Get Your Free Market Analysis</h2>
              <p className="mx-auto mt-2 max-w-md text-small text-ink-muted">
                Fill in the form below and a HomeAtlas advisor will prepare a complimentary, data-backed
                valuation for your property.
              </p>
            </div>

            {formSubmitted ? (
              <div className="rounded-2xl border border-gold bg-surface p-10 text-center shadow-card">
                <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-gold-soft">
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path d="M20 6L9 17l-5-5" stroke="#c7a45a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
                <h3 className="mb-2 text-xl font-bold text-navy">Submission Received</h3>
                <p className="mx-auto max-w-sm text-small leading-relaxed text-ink-muted">
                  Thank you! Our team will prepare your complimentary market analysis within 24 hours. You
                  may also{" "}
                  <Link href="/sell/list" className="font-semibold text-navy underline hover:text-gold">
                    list your property
                  </Link>{" "}
                  directly with our team.
                </p>
              </div>
            ) : (
              <form
                onSubmit={handleFormSubmit}
                className="flex flex-col gap-5 rounded-2xl border border-line bg-surface p-6 shadow-card md:p-8"
              >
                <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                  <div>
                    <label className={labelClass}>Full Name *</label>
                    <input required type="text" placeholder="Jane Smith" value={formName} onChange={(e) => setFormName(e.target.value)} className={inputClass} />
                  </div>
                  <div>
                    <label className={labelClass}>Email Address *</label>
                    <input required type="email" placeholder="jane@email.com" value={formEmail} onChange={(e) => setFormEmail(e.target.value)} className={inputClass} />
                  </div>
                  <div>
                    <label className={labelClass}>Phone Number</label>
                    <input type="tel" placeholder="(416) 555-0100" value={formPhone} onChange={(e) => setFormPhone(e.target.value)} className={inputClass} />
                  </div>
                  <div>
                    <label className={labelClass}>Property Address *</label>
                    <input required type="text" placeholder="123 Main St, Toronto, ON" value={formAddress} onChange={(e) => setFormAddress(e.target.value)} className={inputClass} />
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
                  <div>
                    <label className={labelClass}>Property Type</label>
                    <div className="relative">
                      <select value={formPropertyType} onChange={(e) => setFormPropertyType(e.target.value)} className={selectClass}>
                        <option value="">Select</option>
                        <option>Detached</option>
                        <option>Semi-Detached</option>
                        <option>Townhome</option>
                        <option>Condo</option>
                        <option>Luxury</option>
                      </select>
                      <SelectChevron />
                    </div>
                  </div>
                  <div>
                    <label className={labelClass}>Estimated Value Range</label>
                    <div className="relative">
                      <select value={formValueRange} onChange={(e) => setFormValueRange(e.target.value)} className={selectClass}>
                        <option value="">Select</option>
                        <option>Under $600K</option>
                        <option>$600K – $900K</option>
                        <option>$900K – $1.2M</option>
                        <option>$1.2M – $1.8M</option>
                        <option>$1.8M – $2.5M</option>
                        <option>Over $2.5M</option>
                      </select>
                      <SelectChevron />
                    </div>
                  </div>
                  <div>
                    <label className={labelClass}>Best Time to Contact</label>
                    <div className="relative">
                      <select value={formBestTime} onChange={(e) => setFormBestTime(e.target.value)} className={selectClass}>
                        <option value="">Select</option>
                        <option>Morning (8am–12pm)</option>
                        <option>Afternoon (12pm–5pm)</option>
                        <option>Evening (5pm–8pm)</option>
                        <option>Anytime</option>
                      </select>
                      <SelectChevron />
                    </div>
                  </div>
                </div>
                <div>
                  <label className={labelClass}>Message (Optional)</label>
                  <textarea
                    rows={4}
                    placeholder="Tell us anything relevant about your home or timeline..."
                    value={formMessage}
                    onChange={(e) => setFormMessage(e.target.value)}
                    className={`${inputClass} resize-none`}
                  />
                </div>
                {formError ? <p className="text-caption text-negative">{formError}</p> : null}
                <button
                  type="submit"
                  disabled={submitInquiry.isPending}
                  className="mt-1 flex w-full items-center justify-center gap-2 rounded-xl bg-navy py-4 text-small font-bold uppercase tracking-wide text-white transition hover:bg-navy-deep active:scale-[0.99] disabled:opacity-60"
                >
                  Submit to HomeAtlas Team
                  <IconChevronRight />
                </button>
                <p className="-mt-1 text-center text-[11px] leading-relaxed text-ink-subtle">
                  After submitting, our team will prepare a complimentary market analysis. Prefer to list
                  yourself?{" "}
                  <Link href="/sell/list" className="text-navy underline hover:text-gold">
                    Start the listing form
                  </Link>
                  .
                </p>
              </form>
            )}
          </section>
        </div>
      </div>

      {/* Preconstruction Assignment */}
      <section ref={assignmentRef} className="scroll-mt-20 border-t border-line bg-surface px-4 py-20">
        <div className="mx-auto max-w-3xl">
          <div className="mb-12">
            <span className="mb-3 inline-block text-caption font-semibold uppercase tracking-widest text-gold">
              Preconstruction Assignment
            </span>
            <h2 className="text-3xl font-bold leading-tight text-ink md:text-4xl">How It Works</h2>
          </div>

          <ol className="mb-14 flex flex-col gap-10">
            {[
              {
                title: "Register your assignment in 3 quick steps",
                body: "Submit your unit details, original purchase agreement price, and current asking price. Our team reviews and lists your assignment within 24 hours.",
                icon: (
                  <>
                    <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M9 22V12h6v10" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
                  </>
                ),
              },
              {
                title: "Reach thousands of pre-con buyers across GTA",
                body: "Your assignment is promoted to our curated database of qualified investors and end-users actively searching for pre-construction opportunities — giving you maximum exposure before closing.",
                icon: (
                  <>
                    <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="1.75" />
                    <path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
                  </>
                ),
              },
              {
                title: "Receive serious, vetted inquiries",
                body: "Start hearing from pre-qualified buyers ready to take over your purchase agreement. Our agents handle negotiations and paperwork so your assignment closes smoothly.",
                icon: (
                  <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
                ),
              },
            ].map((step, index) => (
              <li key={step.title} className="flex items-start gap-6">
                <div className="relative shrink-0">
                  <div className="flex h-14 w-14 items-center justify-center rounded-full border-2 border-gold bg-gold-soft text-navy">
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      {step.icon}
                    </svg>
                  </div>
                  <span className="absolute -left-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-navy text-[10px] font-bold text-white">
                    {index + 1}
                  </span>
                </div>
                <div>
                  <h3 className="mb-1.5 text-lg font-bold leading-snug text-ink">{step.title}</h3>
                  <p className="max-w-md text-small leading-relaxed text-ink-muted">{step.body}</p>
                </div>
              </li>
            ))}
          </ol>

          <div className="mb-12 flex flex-col gap-5 border-b border-line pb-12 md:flex-row md:items-center">
            <div className="flex flex-1 items-center gap-2 text-small text-ink-muted">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M3 17l4-8 4 4 4-6 4 10" stroke="#c7a45a" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span>
                GTA pre-construction assignment sales averaged{" "}
                <strong className="text-navy">47 days</strong> on market in 2024 — list early for the best
                outcome.
              </span>
            </div>
            <div className="flex shrink-0 flex-wrap gap-2">
              <button
                type="button"
                onClick={scrollToAssignmentForm}
                className="flex items-center gap-2 rounded-xl bg-navy px-6 py-3 text-caption font-bold uppercase tracking-widest text-gold transition hover:bg-navy-deep active:scale-[0.99]"
              >
                Quick inquiry
                <IconChevronRight />
              </button>
              <Link
                href="/sell/list"
                className="flex items-center gap-2 rounded-xl border border-navy px-6 py-3 text-caption font-bold uppercase tracking-widest text-navy transition hover:bg-navy-tint"
              >
                Full listing form
              </Link>
            </div>
          </div>

          <div id="assignment-form-anchor">
            <div className="mb-8 text-center">
              <span className="text-caption font-semibold uppercase tracking-widest text-gold">No Obligation</span>
              <h3 className="mt-2 text-2xl font-bold text-ink">List Your Preconstruction Assignment</h3>
              <p className="mx-auto mt-2 max-w-sm text-small text-ink-muted">
                Fill in the details below and a HomeAtlas advisor will reach out within one business day.
              </p>
            </div>

            {asgSubmitted ? (
              <div className="rounded-2xl border border-gold bg-surface p-10 text-center shadow-card">
                <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-gold-soft">
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path d="M20 6L9 17l-5-5" stroke="#c7a45a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
                <h4 className="mb-2 text-xl font-bold text-navy">Assignment Received</h4>
                <p className="mx-auto max-w-sm text-small leading-relaxed text-ink-muted">
                  Thanks! A HomeAtlas advisor will review your assignment details and contact you within one
                  business day. Or continue with the{" "}
                  <Link href="/sell/list" className="font-semibold text-navy underline">
                    full listing form
                  </Link>
                  .
                </p>
              </div>
            ) : (
              <form
                onSubmit={handleAssignmentSubmit}
                className="flex flex-col gap-5 rounded-2xl border border-line bg-surface p-6 shadow-card md:p-8"
              >
                <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                  <div>
                    <label className={labelClass}>Full Name *</label>
                    <input required type="text" placeholder="Jane Smith" value={asgName} onChange={(e) => setAsgName(e.target.value)} className={inputClass} />
                  </div>
                  <div>
                    <label className={labelClass}>Email Address *</label>
                    <input required type="email" placeholder="jane@email.com" value={asgEmail} onChange={(e) => setAsgEmail(e.target.value)} className={inputClass} />
                  </div>
                  <div>
                    <label className={labelClass}>Phone Number</label>
                    <input type="tel" placeholder="(416) 555-0100" value={asgPhone} onChange={(e) => setAsgPhone(e.target.value)} className={inputClass} />
                  </div>
                  <div>
                    <label className={labelClass}>Project / Building Name *</label>
                    <input required type="text" placeholder="e.g. The Well Condos, Toronto" value={asgProject} onChange={(e) => setAsgProject(e.target.value)} className={inputClass} />
                  </div>
                  <div>
                    <label className={labelClass}>Unit / Suite Number *</label>
                    <input required type="text" placeholder="e.g. 1204" value={asgUnit} onChange={(e) => setAsgUnit(e.target.value)} className={inputClass} />
                  </div>
                  <div>
                    <label className={labelClass}>Assignment Asking Price *</label>
                    <input required type="text" placeholder="e.g. $750,000" value={asgAskingPrice} onChange={(e) => setAsgAskingPrice(e.target.value)} className={inputClass} />
                  </div>
                  <div className="md:col-span-2">
                    <label className={labelClass}>Estimated Closing / Occupancy Date</label>
                    <input type="text" placeholder="e.g. Q3 2026" value={asgClosingDate} onChange={(e) => setAsgClosingDate(e.target.value)} className={inputClass} />
                  </div>
                </div>
                <div>
                  <label className={labelClass}>Additional Details (Optional)</label>
                  <textarea
                    rows={3}
                    placeholder="Parking, locker, upgrades, or anything relevant to buyers..."
                    value={asgMessage}
                    onChange={(e) => setAsgMessage(e.target.value)}
                    className={`${inputClass} resize-none`}
                  />
                </div>
                {asgError ? <p className="text-caption text-negative">{asgError}</p> : null}
                <button
                  type="submit"
                  disabled={submitInquiry.isPending}
                  className="mt-1 flex w-full items-center justify-center gap-2 rounded-xl bg-gold py-4 text-small font-bold uppercase tracking-wide text-navy transition hover:bg-gold-deep active:scale-[0.99] disabled:opacity-60"
                >
                  Submit Assignment Inquiry
                  <IconChevronRight />
                </button>
                <p className="-mt-1 text-center text-[11px] leading-relaxed text-ink-subtle">
                  A HomeAtlas advisor will contact you within one business day to review your assignment and
                  outline next steps.
                </p>
              </form>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
