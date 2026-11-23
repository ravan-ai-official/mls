"use client";

import { useMemo, useState } from "react";
import { Field, NumericInput } from "@/components/ui/Field";
import { formatPrice } from "@/lib/utils/format";

/**
 * Mortgage payment estimator.
 *
 * Entirely client-side arithmetic — no backend involved, which is why it works
 * even though mls-v2 has no mortgage endpoint. Defaults reflect typical Canadian
 * terms (20% down, 25-year amortization, monthly compounding).
 *
 * Note: Canadian fixed mortgages compound semi-annually by law, so we convert
 * the nominal annual rate accordingly rather than dividing by 12 — dividing
 * would understate the payment.
 */
const DEFAULT_RATE = 4.79;
const DEFAULT_YEARS = 25;
const YEARS_MIN = 1;
const YEARS_MAX = 30;

function clampYears(raw: string): number {
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || raw.trim() === "") return DEFAULT_YEARS;
  return Math.min(YEARS_MAX, Math.max(YEARS_MIN, Math.round(parsed)));
}

export function MortgageCalculator({
  price,
  suggestedRent = null,
}: {
  price: number | null;
  /**
   * @deprecated Ignored — cash-flow "Others" starts at 0 so the user enters
   * any extra annual costs themselves. Kept optional so existing call sites
   * still type-check.
   */
  annualTax?: number | null;
  /** Median asking rent of nearby rentals, used as the starting rental income. */
  suggestedRent?: number | null;
}) {
  const [homePrice, setHomePrice] = useState(price ?? 0);
  const [downPct, setDownPct] = useState(20);
  const [rentIncome, setRentIncome] = useState(suggestedRent ?? 0);
  // "Others" = optional annual costs (insurance, condo extras, …). Always 0
  // until the visitor types a value — not seeded from listing property tax.
  const [othersAnnual, setOthersAnnual] = useState(0);
  const [maintenance, setMaintenance] = useState(150);
  // Held as a string: a numeric state cannot represent the intermediate
  // "5." a user types on the way to "5.25".
  const [rateText, setRateText] = useState(String(DEFAULT_RATE));
  const rate = Number(rateText) || 0;
  // Same for amortization — clamping on every keystroke turned "20" into "30"
  // when typed over an existing value (e.g. "230" → min 30).
  const [yearsText, setYearsText] = useState(String(DEFAULT_YEARS));
  const years = clampYears(yearsText);

  const { monthly, totalInterest } = useMemo(() => {
    const loan = Math.max(0, homePrice * (1 - downPct / 100));
    const n = Math.max(1, years * 12);

    if (loan <= 0) return { monthly: 0, principal: 0, totalInterest: 0 };
    if (rate <= 0) return { monthly: loan / n, principal: loan, totalInterest: 0 };

    // Semi-annual compounding → effective monthly rate.
    const semiAnnual = rate / 100 / 2;
    const monthlyRate = Math.pow(1 + semiAnnual, 2 / 12) - 1;

    const payment =
      (loan * monthlyRate) / (1 - Math.pow(1 + monthlyRate, -n));

    return {
      monthly: payment,
      principal: loan,
      totalInterest: payment * n - loan,
    };
  }, [homePrice, downPct, rate, years]);

  const othersMonthly = Math.round(othersAnnual / 12);
  const cashFlow = Math.round(rentIncome - monthly - othersMonthly - maintenance);
  const flowPct = Math.min(Math.abs(cashFlow) / 500, 1);

  return (
    <section className="rounded-2xl border border-line p-4 sm:p-6">
      <h2 className="text-[18px] font-semibold text-ink">Mortgage Calculator</h2>

      <div className="mt-5 grid gap-5 sm:grid-cols-2">
        <div className="space-y-4">
          <MoneyField id="mc-price" label="Home Price" prefix="$" value={homePrice} onChange={setHomePrice} />
          <MoneyField id="mc-down" label="Down Payment %" suffix="%" value={downPct} max={100} onChange={setDownPct} />
          <MoneyField id="mc-rent" label="Rental Income / mo" prefix="$" value={rentIncome} onChange={setRentIncome} />
          <Field label="Interest rate (%)" htmlFor="mc-rate">
            <NumericInput
              id="mc-rate"
              decimals={2}
              min={0}
              max={25}
              value={rateText}
              onChange={(event) => setRateText(event.target.value)}
            />
          </Field>
          <Field label="Amortization (years)" htmlFor="mc-years">
            <NumericInput
              id="mc-years"
              min={YEARS_MIN}
              max={YEARS_MAX}
              value={yearsText}
              onChange={(event) => setYearsText(event.target.value)}
              onBlur={() => setYearsText(String(clampYears(yearsText)))}
            />
          </Field>
          <div className="rounded-xl bg-surface-alt p-4">
            <div className="mb-1 flex justify-between text-[13px]">
              <span className="text-ink-muted">Mortgage Payment</span>
              <span className="font-semibold text-navy">${Math.round(monthly).toLocaleString()}/mo</span>
            </div>
            <div className="flex justify-between text-[13px]">
              <span className="text-ink-muted">Down payment</span>
              <span className="font-semibold">{downPct}%</span>
            </div>
          </div>
        </div>

        <div>
          <h3 className="mb-4 text-[14px] font-semibold text-ink">Cash Flow Analysis</h3>
          <div className="space-y-2.5 text-[13px]">
            <FlowRow label="Mortgage Payment" value={-Math.round(monthly)} />
            <FlowRow label="Others" value={-othersMonthly} />
            <FlowRow label="Maintenance" value={-maintenance} />
            <FlowRow label="Rental Income" value={Math.round(rentIncome)} />
            <div className="flex justify-between border-t border-line pt-3">
              <span className="font-semibold text-ink">Monthly Cash Flow</span>
              <span className={`text-[16px] font-bold ${cashFlow >= 0 ? "text-green-600" : "text-red-500"}`}>
                {cashFlow >= 0 ? "+" : "−"}${Math.abs(cashFlow).toLocaleString()}
              </span>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <MoneyField id="mc-others" label="Others" prefix="$" value={othersAnnual} onChange={setOthersAnnual} />
            <MoneyField id="mc-maint" label="Maintenance / mo" prefix="$" value={maintenance} onChange={setMaintenance} />
          </div>
          <div className="mt-5 flex items-center justify-center">
            <div className="relative h-28 w-28">
              <svg className="h-28 w-28 -rotate-90" viewBox="0 0 100 100" aria-hidden="true">
                <circle cx="50" cy="50" r="40" fill="none" stroke="#ececec" strokeWidth="12" />
                <circle
                  cx="50"
                  cy="50"
                  r="40"
                  fill="none"
                  stroke={cashFlow >= 0 ? "#22c55e" : "#ef4444"}
                  strokeWidth="12"
                  strokeDasharray={`${flowPct * 251} 251`}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <div className="text-[12px] text-ink-muted">Cash Flow</div>
                <div className={`text-[13px] font-bold ${cashFlow >= 0 ? "text-green-600" : "text-red-500"}`}>
                  ${Math.abs(cashFlow).toLocaleString()}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <p className="mt-4 text-[11px] text-ink-subtle">
        Payment uses semi-annual compounding. Others covers any extra annual costs you enter
        (default $0). Total interest on the loan is {formatPrice(totalInterest)}.
      </p>
    </section>
  );
}

function MoneyField({
  id,
  label,
  value,
  onChange,
  prefix,
  suffix,
  max = 100000000,
}: {
  id: string;
  label: string;
  value: number;
  onChange: (value: number) => void;
  prefix?: string;
  suffix?: string;
  max?: number;
}) {
  // Draft string so clearing / multi-digit typing is not clamped mid-keystroke.
  const [text, setText] = useState(value === 0 ? "" : String(value));

  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-[12px] text-ink-muted">
        {label}
      </label>
      <div className="flex items-center gap-2 rounded-xl border border-line px-4 py-3">
        {prefix && <span className="text-ink-muted">{prefix}</span>}
        <input
          id={id}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          value={text}
          onChange={(event) => {
            const clean = event.target.value.replace(/[^0-9]/g, "");
            setText(clean);
            const next = clean === "" ? 0 : Number(clean);
            onChange(Math.min(max, Math.max(0, Number.isFinite(next) ? next : 0)));
          }}
          onBlur={() => {
            const next = text === "" ? 0 : Math.min(max, Math.max(0, Number(text) || 0));
            setText(next === 0 ? "" : String(next));
            onChange(next);
          }}
          className="w-full bg-transparent text-[14px] text-ink outline-none"
        />
        {suffix && <span className="text-ink-muted">{suffix}</span>}
      </div>
    </div>
  );
}

function FlowRow({ label, value }: { label: string; value: number }) {
  const positive = value > 0;
  return (
    <div className="flex justify-between">
      <span className="text-ink-muted">{label}</span>
      <span className={`font-medium ${positive ? "text-green-600" : "text-red-500"}`}>
        {positive ? "+" : "−"}${Math.abs(value).toLocaleString()}
      </span>
    </div>
  );
}
