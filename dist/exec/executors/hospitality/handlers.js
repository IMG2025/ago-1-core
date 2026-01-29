export function handleHospitality(inputs) {
    // Deterministic stub outputs: no external calls, no filesystem mutation.
    switch (inputs.action) {
        case "RATE_UPDATE":
            return {
                action: inputs.action,
                result: "STUB_APPLIED",
                property_id: inputs.property_id,
                room_type: inputs.room_type ?? null,
                date_range: { start: inputs.date_start, end: inputs.date_end },
                new_rate_cents: inputs.new_rate_cents,
                currency: inputs.currency
            };
        case "TARIFF_SYNC":
            return {
                action: inputs.action,
                result: "STUB_SYNCED",
                source: inputs.source,
                effective_date: inputs.effective_date,
                categories: inputs.categories ?? []
            };
        case "VENDOR_INVOICE_CHECK":
            return {
                action: inputs.action,
                result: "STUB_CHECK_COMPLETE",
                vendor_id: inputs.vendor_id,
                invoice_id: inputs.invoice_id,
                amount_cents: inputs.amount_cents,
                currency: inputs.currency,
                flags: []
            };
        default: {
            const _never = inputs;
            return _never;
        }
    }
}
