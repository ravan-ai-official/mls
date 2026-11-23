"use client";

import { keepPreviousData, queryOptions, useMutation, useQuery } from "@tanstack/react-query";
import {
  AUTOCOMPLETE_MIN_CHARS,
  autocompleteAddress,
  estimateValue,
  lookupSubject,
  type AddressSuggestion,
  type EstimateInput,
  type ValuationResult,
  type ValuationSubject,
} from "@/lib/api/valuation";
import { qk } from "@/lib/queries/keys";

export function addressAutocompleteQuery(q: string) {
  const term = q.trim();
  return queryOptions({
    queryKey: qk.valuation.autocomplete(term),
    queryFn: () => autocompleteAddress(term, { cache: "no-store" }),
    staleTime: 10 * 60_000,
    gcTime: 30 * 60_000,
  });
}

/** Address suggestions for the wizard. Pass an already-debounced value. */
export function useAddressAutocomplete(q: string) {
  return useQuery({
    ...addressAutocompleteQuery(q),
    enabled: q.trim().length >= AUTOCOMPLETE_MIN_CHARS,
    placeholderData: keepPreviousData,
  });
}

/**
 * Stable key for tests / debugging. Lookup itself goes through
 * `lookupSubject` → `/api/mls/valuation/lookup/`.
 */
export function valuationLookupUrl(suggestion: Pick<AddressSuggestion, "listingKey" | "label">) {
  const qs = new URLSearchParams({
    listing_key: suggestion.listingKey ?? "",
    address: suggestion.label,
  });
  return `/api/mls/valuation/lookup?${qs.toString()}`;
}

/**
 * Subject-property details for a picked address. A read, but it runs on a
 * user action and its result moves the wizard on, so it is a mutation: one
 * pending flag, no cache entry to keep around.
 */
export function useValuationLookup() {
  return useMutation({
    mutationFn: (suggestion: AddressSuggestion): Promise<ValuationSubject> =>
      lookupSubject(
        {
          listingKey: suggestion.listingKey ?? undefined,
          address: suggestion.label,
        },
        { cache: "no-store" },
      ),
  });
}

/** Runs the comparable-sales model. Nothing cached depends on it. */
export function useValuationEstimate() {
  return useMutation({
    mutationFn: (input: EstimateInput): Promise<ValuationResult> =>
      estimateValue(input, { cache: "no-store" }),
  });
}
