export type HospitalityAction =
  | "RATE_UPDATE"
  | "TARIFF_SYNC"
  | "VENDOR_INVOICE_CHECK";

export function isHospitalityAction(x: unknown): x is HospitalityAction {
  return x === "RATE_UPDATE" || x === "TARIFF_SYNC" || x === "VENDOR_INVOICE_CHECK";
}
