/**
 * Tab-scoped draft for /sell so soft navigation (open a listing → Back)
 * does not wipe in-progress property / contact / assignment fields.
 * Cleared only on successful submit or an explicit reset — not on unmount.
 * Hard refresh within the same tab restores from sessionStorage.
 */
export const SELL_FORM_DRAFT_KEY = "sell-form-draft-v1";

export interface SellFormDraft {
  address: string;
  propertyType: string;
  beds: string;
  baths: string;
  garage: string;
  lotWidth: string;
  compsVisible: boolean;
  formName: string;
  formEmail: string;
  formPhone: string;
  formAddress: string;
  formPropertyType: string;
  formValueRange: string;
  formBestTime: string;
  formMessage: string;
  sidebarName: string;
  sidebarPhone: string;
  sidebarEmail: string;
  asgName: string;
  asgEmail: string;
  asgPhone: string;
  asgProject: string;
  asgUnit: string;
  asgAskingPrice: string;
  asgClosingDate: string;
  asgMessage: string;
}

export const EMPTY_SELL_FORM_DRAFT: SellFormDraft = {
  address: "",
  propertyType: "",
  beds: "",
  baths: "",
  garage: "",
  lotWidth: "",
  compsVisible: false,
  formName: "",
  formEmail: "",
  formPhone: "",
  formAddress: "",
  formPropertyType: "",
  formValueRange: "",
  formBestTime: "",
  formMessage: "",
  sidebarName: "",
  sidebarPhone: "",
  sidebarEmail: "",
  asgName: "",
  asgEmail: "",
  asgPhone: "",
  asgProject: "",
  asgUnit: "",
  asgAskingPrice: "",
  asgClosingDate: "",
  asgMessage: "",
};

function isDraftShape(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function str(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

/** Merge a stored payload onto empty defaults so older drafts stay readable. */
export function normalizeSellFormDraft(raw: unknown): SellFormDraft | null {
  if (!isDraftShape(raw)) return null;
  return {
    address: str(raw.address),
    propertyType: str(raw.propertyType),
    beds: str(raw.beds),
    baths: str(raw.baths),
    garage: str(raw.garage),
    lotWidth: str(raw.lotWidth),
    compsVisible: Boolean(raw.compsVisible),
    formName: str(raw.formName),
    formEmail: str(raw.formEmail),
    formPhone: str(raw.formPhone),
    formAddress: str(raw.formAddress),
    formPropertyType: str(raw.formPropertyType),
    formValueRange: str(raw.formValueRange),
    formBestTime: str(raw.formBestTime),
    formMessage: str(raw.formMessage),
    sidebarName: str(raw.sidebarName),
    sidebarPhone: str(raw.sidebarPhone),
    sidebarEmail: str(raw.sidebarEmail),
    asgName: str(raw.asgName),
    asgEmail: str(raw.asgEmail),
    asgPhone: str(raw.asgPhone),
    asgProject: str(raw.asgProject),
    asgUnit: str(raw.asgUnit),
    asgAskingPrice: str(raw.asgAskingPrice),
    asgClosingDate: str(raw.asgClosingDate),
    asgMessage: str(raw.asgMessage),
  };
}

export function isSellFormDraftEmpty(draft: SellFormDraft): boolean {
  return (Object.keys(EMPTY_SELL_FORM_DRAFT) as (keyof SellFormDraft)[]).every((key) => {
    const empty = EMPTY_SELL_FORM_DRAFT[key];
    return draft[key] === empty;
  });
}

export function readSellFormDraft(): SellFormDraft | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(SELL_FORM_DRAFT_KEY);
    if (!raw) return null;
    return normalizeSellFormDraft(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function saveSellFormDraft(draft: SellFormDraft): void {
  if (typeof window === "undefined") return;
  try {
    if (isSellFormDraftEmpty(draft)) {
      sessionStorage.removeItem(SELL_FORM_DRAFT_KEY);
      return;
    }
    sessionStorage.setItem(SELL_FORM_DRAFT_KEY, JSON.stringify(draft));
  } catch {
    /* private mode / quota — form still works without persistence */
  }
}

export function clearSellFormDraft(): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(SELL_FORM_DRAFT_KEY);
  } catch {
    /* ignore */
  }
}
