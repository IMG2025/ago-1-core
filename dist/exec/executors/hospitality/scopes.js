function hasAll(scopes, required) {
    const set = new Set(scopes);
    const missing = required.filter((s) => !set.has(s));
    return missing.length === 0 ? { allowed: true } : { allowed: false, missing };
}
/**
 * Hospitality scope policy:
 * - All EXECUTE tasks must include: hospitality:execute (domain-level capability)
 * - Action-level least-privilege scopes:
 *   RATE_UPDATE -> hospitality:rates:write
 *   TARIFF_SYNC -> hospitality:tariffs:sync
 *   VENDOR_INVOICE_CHECK -> hospitality:invoices:review
 */
export function enforceHospitalityActionScopes(actionInputs, taskScopes) {
    const base = hasAll(taskScopes, ["hospitality:execute"]);
    if (!base.allowed)
        return base;
    switch (actionInputs.action) {
        case "RATE_UPDATE":
            return hasAll(taskScopes, ["hospitality:rates:write"]);
        case "TARIFF_SYNC":
            return hasAll(taskScopes, ["hospitality:tariffs:sync"]);
        case "VENDOR_INVOICE_CHECK":
            return hasAll(taskScopes, ["hospitality:invoices:review"]);
        default: {
            const _never = actionInputs;
            return _never;
        }
    }
}
