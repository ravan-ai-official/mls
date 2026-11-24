"use client";

import { Tabs, type TabItem } from "@/components/ui/Tabs";

export interface StatusTabItem {
  id: string;
  label: string;
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
  // Never forward counts — For Sale / Sold / Open house are labels only.
  const tabs: Array<TabItem<string>> = items.map(({ id, label }) => ({ id, label }));
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
