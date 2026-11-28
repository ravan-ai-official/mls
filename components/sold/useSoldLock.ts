"use client";

import { useAuth } from "@/components/providers/AuthProvider";
import { isSoldDataLocked, safeClosePrice } from "@/lib/sold/gate";
import type { ListingTransaction, PropertyStatus } from "@/lib/types/domain";

/** Hook for sold UI surfaces — lock flag + a close price that never leaks. */
export function useSoldLock(input: {
  soldLocked?: boolean | null;
  responseSoldLocked?: boolean | null;
  status?: PropertyStatus | string | null;
  transaction?: ListingTransaction | string | null;
  closePrice?: number | null;
}) {
  const { user } = useAuth();
  const locked = isSoldDataLocked({
    isAuthenticated: Boolean(user),
    soldLocked: input.soldLocked,
    responseSoldLocked: input.responseSoldLocked,
    status: input.status,
    transaction: input.transaction,
  });
  const closePrice = safeClosePrice(user, input.closePrice, input.soldLocked || locked);
  return { user, locked, closePrice };
}
