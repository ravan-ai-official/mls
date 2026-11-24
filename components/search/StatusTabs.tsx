"use client";

import { Tabs, type TabItem } from "@/components/ui/Tabs";

export interface StatusTabItem {
  id: string;
  label: string;
  /** Optional trailing count; omit on listing status tabs. */
  count?: number | null;
  href: string;
}

/**
 * Link-mode segmented tabs for listing status (HomeAtlasUI ListingsPage
 * L190-216). A thin client shim: `Tabs` takes `hrefFor` as a function, which a
 * Server Component cannot pass across the boundary, so the page precomputes
 * each href and this maps ids back to them.
 */
export function StatusTabs({ items, value }: { items: StatusTabItem[]; value: string }) {
  const hrefs = new Map(items.map((item) => [item.id, item.href]));
  const tabs: Array<TabItem<string>> = items.map(({ id, label, count }) => ({ id, label, count }));
  return (
    <Tabs
      items={tabs}
      value={value}
      hrefFor={(id) => hrefs.get(id) ?? "/listings"}
      variant="segmented"
      label="Filter by listing status"
      className="mt-5"
    />
  );
}
