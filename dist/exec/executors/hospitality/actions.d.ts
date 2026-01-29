export type HospitalityAction = "RATE_UPDATE" | "TARIFF_SYNC" | "VENDOR_INVOICE_CHECK";
export declare function isHospitalityAction(x: unknown): x is HospitalityAction;
