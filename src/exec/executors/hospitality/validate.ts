import type { HospitalityAction } from "./actions.js";
import { isHospitalityAction } from "./actions.js";

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

export type HospitalityInputs =
  | RateUpdateInput
  | TariffSyncInput
  | VendorInvoiceCheckInput;

function reqString(obj: Record<string, unknown>, key: string): string {
  const v = obj[key];
  if (typeof v !== "string" || v.trim().length === 0) {
    throw new Error(`INPUT_${key.toUpperCase()}_REQUIRED`);
  }
  return v.trim();
}

function reqNumber(obj: Record<string, unknown>, key: string): number {
  const v = obj[key];
  if (typeof v !== "number" || !Number.isFinite(v)) {
    throw new Error(`INPUT_${key.toUpperCase()}_REQUIRED`);
  }
  return v;
}

function reqIsoDate(obj: Record<string, unknown>, key: string): string {
  const s = reqString(obj, key);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    throw new Error(`INPUT_${key.toUpperCase()}_INVALID_DATE`);
  }
  return s;
}

export function validateHospitalityInputs(inputs: unknown): HospitalityInputs {
  if (typeof inputs !== "object" || inputs === null) {
    throw new Error("INPUTS_REQUIRED");
  }
  const obj = inputs as Record<string, unknown>;

  const actionRaw = obj["action"];
  if (!isHospitalityAction(actionRaw)) {
    throw new Error("INPUT_ACTION_INVALID");
  }

  switch (actionRaw) {
    case "RATE_UPDATE": {
      const property_id = reqString(obj, "property_id");
      const date_start = reqIsoDate(obj, "date_start");
      const date_end = reqIsoDate(obj, "date_end");
      const new_rate_cents = reqNumber(obj, "new_rate_cents");
      const currency = reqString(obj, "currency");

      const room_type =
        typeof obj.room_type === "string" && obj.room_type.trim().length > 0
          ? obj.room_type.trim()
          : undefined;

      return room_type
        ? {
            action: "RATE_UPDATE",
            property_id,
            room_type,
            date_start,
            date_end,
            new_rate_cents,
            currency
          }
        : {
            action: "RATE_UPDATE",
            property_id,
            date_start,
            date_end,
            new_rate_cents,
            currency
          };
    }

    case "TARIFF_SYNC": {
      const source = reqString(obj, "source");
      if (source !== "HTS" && source !== "INTERNAL" && source !== "VENDOR") {
        throw new Error("INPUT_SOURCE_INVALID");
      }

      const effective_date = reqIsoDate(obj, "effective_date");

      const categories =
        Array.isArray(obj.categories)
          ? obj.categories
              .filter((x): x is string => typeof x === "string")
              .map((s) => s.trim())
              .filter((s) => s.length > 0)
          : undefined;

      return categories && categories.length > 0
        ? {
            action: "TARIFF_SYNC",
            source,
            effective_date,
            categories
          }
        : {
            action: "TARIFF_SYNC",
            source,
            effective_date
          };
    }

    case "VENDOR_INVOICE_CHECK": {
      const vendor_id = reqString(obj, "vendor_id");
      const invoice_id = reqString(obj, "invoice_id");
      const amount_cents = reqNumber(obj, "amount_cents");
      const currency = reqString(obj, "currency");

      return {
        action: "VENDOR_INVOICE_CHECK",
        vendor_id,
        invoice_id,
        amount_cents,
        currency
      };
    }
  }
}
