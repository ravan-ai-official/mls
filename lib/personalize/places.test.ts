import { describe, expect, it } from "vitest";
import {
  canonicalizePlace,
  cityFromText,
  parsePlacesCookie,
  serializePlacesCookie,
} from "@/lib/personalize/places";

describe("places cookie helpers", () => {
  it("canonicalizes known cities", () => {
    expect(canonicalizePlace("toronto")).toBe("Toronto");
    expect(canonicalizePlace("RICHMOND HILL")).toBe("Richmond Hill");
    expect(canonicalizePlace("nowhere-ville")).toBeNull();
  });

  it("round-trips the cookie payload", () => {
    const encoded = serializePlacesCookie(["Oakville", "toronto", "Oakville"]);
    expect(parsePlacesCookie(encoded)).toEqual(["Oakville", "Toronto"]);
  });

  it("finds a city inside free text", () => {
    expect(cityFromText("3 bed condo in Mississauga under 900k")).toBe("Mississauga");
  });
});
