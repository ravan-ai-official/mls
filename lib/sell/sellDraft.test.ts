import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearSellFormDraft,
  EMPTY_SELL_FORM_DRAFT,
  isSellFormDraftEmpty,
  normalizeSellFormDraft,
  readSellFormDraft,
  saveSellFormDraft,
  SELL_FORM_DRAFT_KEY,
} from "./sellDraft";

function installSessionStorageMock() {
  const store = new Map<string, string>();
  const mock = {
    getItem: (key: string) => (store.has(key) ? store.get(key)! : null),
    setItem: (key: string, value: string) => {
      store.set(key, String(value));
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
    clear: () => {
      store.clear();
    },
  };
  vi.stubGlobal("sessionStorage", mock);
  vi.stubGlobal("window", { sessionStorage: mock });
  return mock;
}

describe("sellForm draft (sessionStorage)", () => {
  beforeEach(() => {
    installSessionStorageMock();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("normalizes partial payloads onto empty defaults", () => {
    const draft = normalizeSellFormDraft({ address: "15 Moriarity", compsVisible: 1 });
    expect(draft?.address).toBe("15 Moriarity");
    expect(draft?.compsVisible).toBe(true);
    expect(draft?.formEmail).toBe("");
  });

  it("round-trips through sessionStorage and clears on empty", () => {
    saveSellFormDraft({ ...EMPTY_SELL_FORM_DRAFT, address: "91 Sherwood", beds: "3" });
    expect(sessionStorage.getItem(SELL_FORM_DRAFT_KEY)).toBeTruthy();
    expect(readSellFormDraft()?.address).toBe("91 Sherwood");
    expect(readSellFormDraft()?.beds).toBe("3");

    saveSellFormDraft(EMPTY_SELL_FORM_DRAFT);
    expect(sessionStorage.getItem(SELL_FORM_DRAFT_KEY)).toBeNull();
    expect(isSellFormDraftEmpty(EMPTY_SELL_FORM_DRAFT)).toBe(true);

    saveSellFormDraft({ ...EMPTY_SELL_FORM_DRAFT, formName: "Jane" });
    clearSellFormDraft();
    expect(readSellFormDraft()).toBeNull();
  });

  it("survives sessionStorage failures", () => {
    vi.stubGlobal("sessionStorage", {
      getItem: () => null,
      setItem: () => {
        throw new Error("quota");
      },
      removeItem: () => {
        throw new Error("quota");
      },
      clear: () => undefined,
    });
    expect(() =>
      saveSellFormDraft({ ...EMPTY_SELL_FORM_DRAFT, address: "x" }),
    ).not.toThrow();
    expect(() => clearSellFormDraft()).not.toThrow();
  });
});
