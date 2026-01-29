import type { HospitalityInputs } from "./validate.js";
export type MissingScopes = Readonly<{
    allowed: boolean;
    missing?: readonly string[];
}>;
/**
 * Hospitality scope policy:
 * - All EXECUTE tasks must include: hospitality:execute (domain-level capability)
 * - Action-level least-privilege scopes:
 *   RATE_UPDATE -> hospitality:rates:write
 *   TARIFF_SYNC -> hospitality:tariffs:sync
 *   VENDOR_INVOICE_CHECK -> hospitality:invoices:review
 */
export declare function enforceHospitalityActionScopes(actionInputs: HospitalityInputs, taskScopes: readonly string[]): MissingScopes;
