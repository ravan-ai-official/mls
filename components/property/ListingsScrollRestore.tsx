"use client";

import { useListingsScrollRestore } from "@/lib/hooks/useListingsScrollRestore";

/** Client island so the server listings page can restore scroll on back. */
export function ListingsScrollRestore() {
  useListingsScrollRestore();
  return null;
}
