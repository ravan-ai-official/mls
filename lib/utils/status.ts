/**
 * Listing status groups.
 *
 * Mirrors mls-backend's `status_group` filter (mls/services/query_helpers.py)
 * so the Watched sub-tabs group a saved home the same way search would.
 * Feeds disagree on vocabulary — DDF says "Active", TRREB says "Sold"/"Closed",
 * de-listings arrive as any of several words — hence the lookup rather than an
 * equality check.
 */

export type StatusGroup = "active" | "sold" | "delisted";

export const STATUS_GROUP_LABELS: Record<StatusGroup, string> = {
  active: "For Sale",
  sold: "Sold",
  delisted: "De-listed",
};

const SOLD = new Set(["sold", "closed", "leased", "rented"]);
const DELISTED = new Set([
  "expired",
  "terminated",
  "suspended",
  "cancelled",
  "canceled",
  "withdrawn",
  "de-listed",
  "delisted",
  "off market",
  "hold",
]);

export function statusGroup(status: string | null | undefined): StatusGroup {
  const value = (status ?? "").trim().toLowerCase();
  if (SOLD.has(value)) return "sold";
  if (DELISTED.has(value)) return "delisted";
  // Active Under Contract / Coming Soon / Pending stay on For Sale.
  return "active";
}

/** Keys of mls-v2's `status_group` filter and facet counts. */
export type BackendStatusGroup = "active" | "sold" | "de-listed";

/**
 * The fixed listing-status tabs, HouseSigma-style: For Sale / Sold / De-listed.
 * `param` is the canonical `?status=` value each tab writes to the URL.
 */
export const STATUS_TABS: ReadonlyArray<{
  group: BackendStatusGroup;
  param: string;
  label: string;
}> = [
  { group: "active", param: "Active", label: STATUS_GROUP_LABELS.active },
  { group: "sold", param: "Sold", label: STATUS_GROUP_LABELS.sold },
  { group: "de-listed", param: "De-listed", label: STATUS_GROUP_LABELS.delisted },
];

/**
 * De-listed is staff-only on the public listings page (mls-backend
 * `viewer_can_see_delisted`). Prefer `is_staff` — `can_author` /
 * `can_use_studio` are not enough for this feed gate.
 */
export function listingStatusTabs(isStaff: boolean): typeof STATUS_TABS {
  if (isStaff) return STATUS_TABS;
  return STATUS_TABS.filter((tab) => tab.group !== "de-listed");
}

/**
 * A `?status=` value → the backend group it selects, or null for anything
 * else. Unlike `statusGroup()` there is no default: a raw feed word typed
 * into the URL stays an exact `status` filter rather than silently widening.
 */
export function backendStatusGroup(status: string | null | undefined): BackendStatusGroup | null {
  switch ((status ?? "").trim().toLowerCase()) {
    case "active":
    case "for sale":
      return "active";
    case "sold":
      return "sold";
    case "de-listed":
    case "delisted":
      return "de-listed";
    default:
      return null;
  }
}

/** The canonical `?status=` value for a backend group. */
export function statusParamForGroup(group: string | null | undefined): string | undefined {
  return STATUS_TABS.find((tab) => tab.group === group)?.param;
}
