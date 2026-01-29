export type RateUpdateInput = Readonly<{
    action: "RATE_UPDATE";
    property_id: string;
    room_type?: string;
    date_start: string;
    date_end: string;
    new_rate_cents: number;
    currency: string;
}>;
export type TariffSyncInput = Readonly<{
    action: "TARIFF_SYNC";
    source: "HTS" | "INTERNAL" | "VENDOR";
    effective_date: string;
    categories?: readonly string[];
}>;
export type VendorInvoiceCheckInput = Readonly<{
    action: "VENDOR_INVOICE_CHECK";
    vendor_id: string;
    invoice_id: string;
    amount_cents: number;
    currency: string;
}>;
export type HospitalityInputs = RateUpdateInput | TariffSyncInput | VendorInvoiceCheckInput;
export declare function validateHospitalityInputs(inputs: unknown): HospitalityInputs;
