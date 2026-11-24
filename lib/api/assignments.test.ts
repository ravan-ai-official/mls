import { describe, expect, it } from "vitest";
import {
  absoluteMediaUrl,
  assignmentTitle,
  isOptimizableImage,
  listingHasPhoto,
  mapPublicListing,
} from "./assignments";

describe("mapPublicListing", () => {
  const row = {
    id: 7,
    purpose: "assignment",
    source_label: "Owner",
    address_line_1: "12 King St",
    city: "Vaughan",
    property_type: "Condo",
    bedrooms: "2.0",
    bathrooms: "2.0",
    asking_price: "689000.00",
    project_name: "Festival Tower",
    builder_name: "Menkes",
    occupancy_date: "2027-06-01",
    precon_property: 42,
    published_at: "2026-09-20T10:00:00Z",
    media: [{ file_url: "https://res.cloudinary.com/x/a.jpg" }, { file_url: "/media/b.jpg" }, { file_url: "" }],
  };

  it("parses DRF decimals and keeps only usable photos", () => {
    const listing = mapPublicListing(row);
    expect(listing.askingPrice).toBe(689000);
    expect(listing.beds).toBe(2);
    expect(listing.preconProjectId).toBe(42);
    expect(listing.photos).toHaveLength(2);
    expect(listing.photos[1]).toMatch(/^https?:\/\/.+\/media\/b\.jpg$/);
  });

  it("titles by project, falling back to the address", () => {
    expect(assignmentTitle(mapPublicListing(row))).toBe("Festival Tower");
    expect(assignmentTitle(mapPublicListing({ ...row, project_name: "" }))).toBe("12 King St");
  });

  it("detects usable card photos", () => {
    expect(listingHasPhoto(mapPublicListing(row))).toBe(true);
    expect(listingHasPhoto(mapPublicListing({ ...row, media: [] }))).toBe(false);
  });
});

describe("media urls", () => {
  it("leaves absolute urls alone", () => {
    expect(absoluteMediaUrl("https://res.cloudinary.com/x.jpg")).toBe("https://res.cloudinary.com/x.jpg");
  });

  it("only optimises Cloudinary images", () => {
    expect(isOptimizableImage("https://res.cloudinary.com/x.jpg")).toBe(true);
    expect(isOptimizableImage("http://localhost:8000/media/x.jpg")).toBe(false);
  });
});
