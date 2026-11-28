/**
 * HouseSigma-style sold-data gate.
 *
 * API `sold_locked` is the source of truth; anonymous clients also gate when
 * status/transaction is sold so a stale cache never leaks close prices.
 */

import type { AuthUser, ListingTransaction, PropertyStatus } from "@/lib/types/domain";

export type SoldGateInput = {
  /** True when a signed-in user is present. */
  isAuthenticated: boolean;
  /** Per-row / detail flag from the API. */
  soldLocked?: boolean | null;
  /** Top-level filter / rail envelope flag. */
  responseSoldLocked?: boolean | null;
  status?: PropertyStatus | string | null;
  transaction?: ListingTransaction | string | null;
};

/** Whether sold prices / details must stay hidden. */
export function isSoldDataLocked(input: SoldGateInput): boolean {
  if (input.isAuthenticated) return false;
  if (input.soldLocked === true || input.responseSoldLocked === true) return true;
  if (input.transaction === "sold") return true;
  if (input.status === "sold" || input.status === "Sold") return true;
  return false;
}

/** Never return a close price for anonymous (or API-locked) payloads. */
export function safeClosePrice(
  user: AuthUser | null | undefined,
  closePrice: number | null | undefined,
  soldLocked?: boolean | null,
): number | null {
  if (!user || soldLocked) return null;
  return closePrice ?? null;
}

export function isAuthenticatedUser(user: AuthUser | null | undefined): boolean {
  return Boolean(user);
}
