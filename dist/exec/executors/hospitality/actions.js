export function isHospitalityAction(x) {
    return x === "RATE_UPDATE" || x === "TARIFF_SYNC" || x === "VENDOR_INVOICE_CHECK";
}
