import { describe, expect, it } from "vitest";
import { EMPTY, formatPriceCompact, formatTorontoDateTime } from "./format";
import { formatPhone, maskPhone, toE164 } from "./phone";
import { formatPostal, looksLikePostal, normalizePostal, parsePostalList } from "./postal";
import {
  backendStatusGroup,
  listingStatusTabs,
  STATUS_TABS,
  statusGroup,
  statusParamForGroup,
} from "./status";
import { getVideoEmbed } from "./video";

describe("toE164", () => {
  it("normalises NANP numbers", () => {
    expect(toE164("(416) 555-0123")).toBe("+14165550123");
    expect(toE164("1 416 555 0123")).toBe("+14165550123");
    expect(toE164("+1 416-555-0123")).toBe("+14165550123");
  });
  it("rejects short NANP input", () => {
    expect(toE164("555-0123")).toBeNull();
    expect(toE164("")).toBeNull();
  });
  it("applies other dial codes and drops a trunk zero", () => {
    expect(toE164("07911 123456", "+44")).toBe("+447911123456");
    expect(toE164("98765 43210", "+91")).toBe("+919876543210");
  });
  it("formats and masks", () => {
    expect(formatPhone("+14165550123")).toBe("+1 (416) 555-0123");
    expect(maskPhone("+14165550123")).toBe("•••• 0123");
  });
});

describe("postal codes", () => {
  it("accepts FSA and full codes in any case/spacing", () => {
    expect(normalizePostal("l7a")).toBe("L7A");
    expect(normalizePostal("L7A 3K9")).toBe("L7A3K9");
    expect(normalizePostal(" l7a3k9 ")).toBe("L7A3K9");
  });
  it("rejects impossible letters and shapes", () => {
    expect(normalizePostal("D7A")).toBeNull(); // D never used
    expect(normalizePostal("W7A")).toBeNull(); // W never leads
    expect(normalizePostal("L7O")).toBeNull(); // O never used
    expect(normalizePostal("L7A3K")).toBeNull();
    expect(normalizePostal("Toronto")).toBeNull();
  });
  it("parses lists, keeping a spaced full code whole", () => {
    expect(parsePostalList("L7A, L6P 2K1")).toEqual({ codes: ["L7A", "L6P2K1"], invalid: [] });
    expect(parsePostalList("L7A L6P")).toEqual({ codes: ["L7A", "L6P"], invalid: [] });
    expect(parsePostalList("L7A, nope").invalid).toEqual(["nope"]);
  });
  it("detects postal-only search text", () => {
    expect(looksLikePostal("L7A 3K9")).toBe(true);
    expect(looksLikePostal("123 Main St")).toBe(false);
    expect(formatPostal("L7A3K9")).toBe("L7A 3K9");
  });
});

describe("statusGroup", () => {
  it("groups feed vocab", () => {
    expect(statusGroup("Active")).toBe("active");
    expect(statusGroup("Sold")).toBe("sold");
    expect(statusGroup("Closed")).toBe("sold");
    expect(statusGroup("Expired")).toBe("delisted");
    expect(statusGroup("Terminated")).toBe("delisted");
    expect(statusGroup(null)).toBe("active");
  });
});

describe("backendStatusGroup", () => {
  it("maps tab params to backend groups and nothing else", () => {
    expect(backendStatusGroup("Active")).toBe("active");
    expect(backendStatusGroup("sold")).toBe("sold");
    expect(backendStatusGroup("De-listed")).toBe("de-listed");
    expect(backendStatusGroup("delisted")).toBe("de-listed");
    // Raw feed words stay exact status filters.
    expect(backendStatusGroup("high")).toBeNull();
    expect(backendStatusGroup("Terminated")).toBeNull();
    expect(backendStatusGroup(undefined)).toBeNull();
  });

  it("round-trips through the canonical param", () => {
    for (const tab of STATUS_TABS) {
      expect(backendStatusGroup(statusParamForGroup(tab.group))).toBe(tab.group);
    }
  });
});

describe("listingStatusTabs", () => {
  it("hides De-listed for non-staff and keeps it for staff", () => {
    expect(listingStatusTabs(false).map((tab) => tab.group)).toEqual([
      "active",
      "sold",
    ]);
    expect(listingStatusTabs(true).map((tab) => tab.group)).toEqual([
      "active",
      "sold",
      "de-listed",
    ]);
  });
});

describe("getVideoEmbed", () => {
  const id = "dQw4w9WgXcQ";
  it.each([
    `https://www.youtube.com/watch?v=${id}`,
    `https://youtu.be/${id}`,
    `https://m.youtube.com/watch?v=${id}&feature=share`,
    `https://www.youtube.com/shorts/${id}`,
    `https://www.youtube.com/live/${id}`,
    `https://www.youtube.com/embed/${id}?autoplay=1`,
    `https://www.youtube-nocookie.com/embed/${id}`,
  ])("resolves %s to a nocookie rel=0 embed", (url) => {
    const embed = getVideoEmbed(url);
    expect(embed?.provider).toBe("youtube");
    expect(embed?.id).toBe(id);
    expect(embed?.embedUrl).toContain(`https://www.youtube-nocookie.com/embed/${id}?`);
    expect(embed?.embedUrl).toContain("rel=0");
    // Source params (autoplay) are never carried through.
    expect(embed?.embedUrl).not.toContain("autoplay");
  });
  it("carries a start offset", () => {
    expect(getVideoEmbed(`https://youtu.be/${id}?t=1m30s`)?.start).toBe(90);
    expect(getVideoEmbed(`https://youtu.be/${id}?t=45`)?.embedUrl).toContain("start=45");
  });
  it("resolves vimeo", () => {
    expect(getVideoEmbed("https://vimeo.com/123456789")?.embedUrl).toBe(
      "https://player.vimeo.com/video/123456789?dnt=1",
    );
    expect(getVideoEmbed("https://player.vimeo.com/video/123456789")?.id).toBe("123456789");
  });
  it("rejects anything else", () => {
    expect(getVideoEmbed("https://evil.example/embed/dQw4w9WgXcQ")).toBeNull();
    expect(getVideoEmbed("javascript:alert(1)")).toBeNull();
    expect(getVideoEmbed("https://www.youtube.com/watch?v=short")).toBeNull();
    expect(getVideoEmbed("not a url")).toBeNull();
    expect(getVideoEmbed(null)).toBeNull();
  });
});

describe("formatPriceCompact", () => {
  it("rolls over to millions instead of printing $1000K", () => {
    expect(formatPriceCompact(999_534)).toBe("$1M");
    expect(formatPriceCompact(999_400)).toBe("$999K");
    expect(formatPriceCompact(1_120_000)).toBe("$1.12M");
    expect(formatPriceCompact(952_000)).toBe("$952K");
    expect(formatPriceCompact(2_000_000)).toBe("$2M");
  });
});

describe("formatTorontoDateTime", () => {
  it("renders in Toronto time regardless of the input offset", () => {
    // 21:10 UTC on Sep 25 is 17:10 EDT.
    const out = formatTorontoDateTime("2026-09-25T21:10:00Z");
    expect(out).toContain("Sep 25, 2026");
    expect(out).toMatch(/5:10/);
    expect(out.endsWith("ET")).toBe(true);
  });

  it("crosses the date line into the previous Toronto day", () => {
    expect(formatTorontoDateTime("2026-09-26T02:00:00Z")).toContain("Sep 25, 2026");
  });

  it("returns the placeholder for missing or invalid input", () => {
    expect(formatTorontoDateTime(null)).toBe(EMPTY);
    expect(formatTorontoDateTime("not a date")).toBe(EMPTY);
  });
});
