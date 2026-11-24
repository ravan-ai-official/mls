/**
 * Test-only assignment fixtures. Production /assignments codepaths must never
 * import this module — live data comes from listing-submissions/public only.
 */

import type { AssignmentQuery, PublicListing, PublicListingPage } from "@/lib/api/assignments";

const shot = (id: string) =>
  `https://images.unsplash.com/${id}?w=1400&h=900&fit=crop&auto=format`;

const GALLERY = [
  "photo-1545324418-cc1a3fa10c00",
  "photo-1502672260266-1c1ef2d93688",
  "photo-1522708323590-d24dbb6b0267",
  "photo-1486325212027-8081e485255e",
  "photo-1600585154340-be6161a56a0c",
  "photo-1600596542815-ffad4c1539a9",
  "photo-1564013799919-ab600027ffc6",
  "photo-1512917774080-9991f1c4c750",
  "photo-1493809842364-78817add7ffb",
  "photo-1600210492486-724fe5c67fb0",
  "photo-1570129477492-45c003edd2be",
  "photo-1568605114967-8130f3a36994",
];

function photos(start: number): string[] {
  return [0, 1, 2].map((offset) => shot(GALLERY[(start + offset) % GALLERY.length]!));
}

function sample(
  listing: Omit<PublicListing, "purpose" | "province" | "addressLine2" | "preconProjectId" | "photos"> & {
    photoStart: number;
    addressLine2?: string;
  },
): PublicListing {
  const { photoStart, addressLine2 = "", ...rest } = listing;
  return {
    ...rest,
    purpose: "assignment",
    province: "ON",
    addressLine2,
    preconProjectId: null,
    photos: photos(photoStart),
  };
}

/** Newest first. Ids are stable so /assignments/101 and the rest stay shareable during the demo. */
export const SAMPLE_ASSIGNMENTS: PublicListing[] = [
  sample({
    id: 101,
    photoStart: 0,
    sourceLabel: "Owner",
    addressLine1: "88 Harbour St",
    addressLine2: "Suite 2411",
    city: "Toronto",
    postalCode: "M5J 0C3",
    propertyType: "Condo apartment",
    beds: 1,
    baths: 1,
    sqft: 612,
    askingPrice: 589_000,
    availableFrom: "2026-11-01",
    description:
      "One-bedroom assignment in a waterfront tower, with a locker and parking included. The buyer takes over the agreement before occupancy. Original purchase details are held by our team and shared with serious buyers.",
    projectName: "Harbour House",
    builderName: "Menkes",
    occupancyDate: "2027-06-01",
    publishedAt: "2026-09-28T14:00:00Z",
  }),
  sample({
    id: 102,
    photoStart: 1,
    sourceLabel: "Agent",
    addressLine1: "21 Widmer St",
    addressLine2: "Suite 1808",
    city: "Toronto",
    postalCode: "M5V 0E5",
    propertyType: "Condo apartment",
    beds: 2,
    baths: 2,
    sqft: 798,
    askingPrice: 749_000,
    availableFrom: null,
    description:
      "Corner two-bedroom with a den, south exposure, and a balcony over King West. Assignment is permitted under the builder's terms. Occupancy is scheduled for late 2027.",
    projectName: "Festival Tower",
    builderName: "Menkes",
    occupancyDate: "2027-11-15",
    publishedAt: "2026-09-26T14:00:00Z",
  }),
  sample({
    id: 113,
    photoStart: 2,
    sourceLabel: "Builder",
    addressLine1: "15 Bloor St W",
    addressLine2: "Suite 3902",
    city: "Toronto",
    postalCode: "M4W 1A2",
    propertyType: "Condo apartment",
    beds: 2,
    baths: 2,
    sqft: 1040,
    askingPrice: 1_425_000,
    availableFrom: null,
    description:
      "High-floor Yorkville suite with two parking spots. The original purchaser is assigning the contract well before closing. Floor plan is available on request.",
    projectName: "The Cumberland",
    builderName: "Tridel",
    occupancyDate: "2028-03-01",
    publishedAt: "2026-09-24T14:00:00Z",
  }),
  sample({
    id: 103,
    photoStart: 3,
    sourceLabel: "Owner",
    addressLine1: "3980 Confederation Pkwy",
    addressLine2: "Suite 2206",
    city: "Mississauga",
    postalCode: "L5B 0K2",
    propertyType: "Condo apartment",
    beds: 2,
    baths: 2,
    sqft: 860,
    askingPrice: 829_000,
    availableFrom: "2026-12-01",
    description:
      "Square One assignment, steps from the transit hub. Two bedrooms, two baths, and a storage locker. Deposit already paid to the builder; the assignment fee is private until you inquire.",
    projectName: "Arc Tower",
    builderName: "Daniels",
    occupancyDate: "2027-08-01",
    publishedAt: "2026-09-22T14:00:00Z",
  }),
  sample({
    id: 114,
    photoStart: 4,
    sourceLabel: "Agent",
    addressLine1: "30 Hurontario St",
    city: "Mississauga",
    postalCode: "L5G 3H3",
    propertyType: "Condo apartment",
    beds: 2,
    baths: 2,
    sqft: 940,
    askingPrice: 969_000,
    availableFrom: null,
    description:
      "Port Credit suite with a lake view and one underground parking space. The agreement can be assigned with the builder's consent, which the seller has already requested.",
    projectName: "Lakeshore House",
    builderName: "FRAM",
    occupancyDate: "2027-09-30",
    publishedAt: "2026-09-18T14:00:00Z",
  }),
  sample({
    id: 104,
    photoStart: 5,
    sourceLabel: "Owner",
    addressLine1: "100 New Park Pl",
    addressLine2: "Suite 907",
    city: "Vaughan",
    postalCode: "L4H 0C3",
    propertyType: "Condo apartment",
    beds: 1,
    baths: 1,
    sqft: 548,
    askingPrice: 649_000,
    availableFrom: null,
    description:
      "Vaughan Metropolitan Centre one-bedroom plus den, beside the subway. A practical entry assignment with occupancy next summer.",
    projectName: "Linea",
    builderName: "CentreCourt",
    occupancyDate: "2027-07-01",
    publishedAt: "2026-09-16T14:00:00Z",
  }),
  sample({
    id: 105,
    photoStart: 6,
    sourceLabel: "Agent",
    addressLine1: "2140 Lakeshore Rd W",
    city: "Oakville",
    postalCode: "L6L 1H3",
    propertyType: "Townhouse",
    beds: 3,
    baths: 3,
    sqft: 1680,
    askingPrice: 1_185_000,
    availableFrom: "2027-04-01",
    description:
      "Three-bedroom freehold town assignment near Bronte. Finished lower level is included in the builder spec. Original purchase price stays with our review team.",
    projectName: "Lakeshore Commons",
    builderName: "Mattamy",
    occupancyDate: "2027-10-01",
    publishedAt: "2026-09-14T14:00:00Z",
  }),
  sample({
    id: 106,
    photoStart: 7,
    sourceLabel: "Owner",
    addressLine1: "179 Enterprise Blvd",
    addressLine2: "Suite 1214",
    city: "Markham",
    postalCode: "L6G 0E7",
    propertyType: "Condo apartment",
    beds: 1,
    baths: 1,
    sqft: 530,
    askingPrice: 545_000,
    availableFrom: null,
    description:
      "Downtown Markham studio-plus-one with parking. Listed by the original purchaser, who is relocating before occupancy.",
    projectName: "Union City",
    builderName: "Times Group",
    occupancyDate: "2027-05-15",
    publishedAt: "2026-09-12T14:00:00Z",
  }),
  sample({
    id: 107,
    photoStart: 8,
    sourceLabel: "Builder",
    addressLine1: "820 Main St E",
    city: "Milton",
    postalCode: "L9T 0J8",
    propertyType: "Townhouse",
    beds: 3,
    baths: 2,
    sqft: 1520,
    askingPrice: 899_000,
    availableFrom: null,
    description:
      "End-unit townhome assignment in a new Milton community. Three bedrooms, a private yard, and a single-car garage. Builder assignment fee schedule applies.",
    projectName: "Willmott Greens",
    builderName: "Mattamy",
    occupancyDate: "2028-01-15",
    publishedAt: "2026-09-10T14:00:00Z",
  }),
  sample({
    id: 108,
    photoStart: 9,
    sourceLabel: "Agent",
    addressLine1: "65 Remembrance Dr",
    addressLine2: "Suite 608",
    city: "Brampton",
    postalCode: "L6Y 0B3",
    propertyType: "Condo apartment",
    beds: 2,
    baths: 2,
    sqft: 780,
    askingPrice: 715_000,
    availableFrom: "2026-10-15",
    description:
      "Mount Pleasant two-bedroom with a balcony and one parking spot. A straightforward assignment for a buyer who wants to be in before the end of 2027.",
    projectName: "Motive",
    builderName: "Great Gulf",
    occupancyDate: "2027-12-01",
    publishedAt: "2026-09-08T14:00:00Z",
  }),
  sample({
    id: 109,
    photoStart: 10,
    sourceLabel: "Owner",
    addressLine1: "9185 Yonge St",
    addressLine2: "Suite 1505",
    city: "Richmond Hill",
    postalCode: "L4C 0Y2",
    propertyType: "Condo apartment",
    beds: 2,
    baths: 2,
    sqft: 890,
    askingPrice: 1_049_000,
    availableFrom: null,
    description:
      "Yonge corridor two-bedroom with a den. The seller has paid the deposits to date and is assigning the remaining contract.",
    projectName: "Plaza Richmond",
    builderName: "Liberty",
    occupancyDate: "2028-02-01",
    publishedAt: "2026-09-06T14:00:00Z",
  }),
  sample({
    id: 110,
    photoStart: 11,
    sourceLabel: "Agent",
    addressLine1: "1250 Brant St",
    city: "Burlington",
    postalCode: "L7P 1X8",
    propertyType: "Townhouse",
    beds: 3,
    baths: 2,
    sqft: 1410,
    askingPrice: 780_000,
    availableFrom: null,
    description:
      "Three-bedroom town assignment north of the QEW. Open kitchen, two baths, and a single garage. Occupancy is set for spring 2027.",
    projectName: "Brant Common",
    builderName: "National Homes",
    occupancyDate: "2027-04-30",
    publishedAt: "2026-09-04T14:00:00Z",
  }),
  sample({
    id: 111,
    photoStart: 2,
    sourceLabel: "Owner",
    addressLine1: "1355 Kingston Rd",
    addressLine2: "Suite 411",
    city: "Pickering",
    postalCode: "L1V 1B7",
    propertyType: "Condo apartment",
    beds: 2,
    baths: 1,
    sqft: 740,
    askingPrice: 625_000,
    availableFrom: null,
    description:
      "Pickering waterfront-area two-bedroom. One bath, a balcony, and a locker. The seller can close the assignment on a standard 30-day timeline after builder consent.",
    projectName: "Frenchman's Bay",
    builderName: "Chestnut Hill",
    occupancyDate: "2027-06-30",
    publishedAt: "2026-09-02T14:00:00Z",
  }),
  sample({
    id: 112,
    photoStart: 4,
    sourceLabel: "Owner",
    addressLine1: "70 Harwood Ave S",
    addressLine2: "Suite 905",
    city: "Ajax",
    postalCode: "L1S 0A8",
    propertyType: "Condo apartment",
    beds: 1,
    baths: 1,
    sqft: 560,
    askingPrice: 575_000,
    availableFrom: null,
    description:
      "Downtown Ajax one-bedroom with parking. A lower-priced assignment for a first buyer who wants a new build without waiting on a fresh launch.",
    projectName: "Harwood House",
    builderName: "Fieldgate",
    occupancyDate: "2027-03-01",
    publishedAt: "2026-08-30T14:00:00Z",
  }),
  sample({
    id: 115,
    photoStart: 6,
    sourceLabel: "Agent",
    addressLine1: "220 Cannon St E",
    addressLine2: "Suite 702",
    city: "Hamilton",
    postalCode: "L8L 2B1",
    propertyType: "Condo apartment",
    beds: 1,
    baths: 1,
    sqft: 510,
    askingPrice: 499_000,
    availableFrom: null,
    description:
      "Downtown Hamilton one-bedroom assignment under $500K. Parking is optional and not included in the asking price. Occupancy is early 2027.",
    projectName: "Cannon Lofts",
    builderName: "UrbanCore",
    occupancyDate: "2027-02-01",
    publishedAt: "2026-08-28T14:00:00Z",
  }),
];

export function sampleAssignment(id: number): PublicListing | null {
  return SAMPLE_ASSIGNMENTS.find((listing) => listing.id === id) ?? null;
}

/** Same city first, then the rest of the sample set. */
export function sampleSimilarAssignments(id: number, limit = 4): PublicListing[] {
  const current = sampleAssignment(id);
  if (!current) return [];
  const rest = SAMPLE_ASSIGNMENTS.filter((listing) => listing.id !== id);
  const sameCity = rest.filter((listing) => listing.city === current.city);
  const others = rest.filter((listing) => listing.city !== current.city);
  return [...sameCity, ...others].slice(0, limit);
}

export function sampleAssignmentPage(query: AssignmentQuery = {}): PublicListingPage {
  const pageSize = query.pageSize ?? 12;
  const page = Math.max(1, query.page ?? 1);
  let rows = SAMPLE_ASSIGNMENTS;

  if (query.city) {
    const city = query.city.toLowerCase();
    rows = rows.filter((listing) => listing.city.toLowerCase() === city);
  }
  if (query.priceMin != null) {
    rows = rows.filter((listing) => listing.askingPrice != null && listing.askingPrice >= query.priceMin!);
  }
  if (query.priceMax != null) {
    rows = rows.filter((listing) => listing.askingPrice != null && listing.askingPrice <= query.priceMax!);
  }
  if (query.bedsMin != null) {
    rows = rows.filter((listing) => listing.beds != null && listing.beds >= query.bedsMin!);
  }
  if (query.preconProjectId != null) {
    rows = rows.filter((listing) => listing.preconProjectId === query.preconProjectId);
  }

  const start = (page - 1) * pageSize;
  const availableCities = [
    ...new Set(SAMPLE_ASSIGNMENTS.map((listing) => listing.city).filter(Boolean)),
  ].sort((a, b) => a.localeCompare(b));
  return {
    count: rows.length,
    page,
    pageSize,
    results: rows.slice(start, start + pageSize),
    availableCities,
  };
}
