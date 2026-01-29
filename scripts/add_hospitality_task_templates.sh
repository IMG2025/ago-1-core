#!/usr/bin/env bash
set -euo pipefail

mkdir -p src/exec/executors/hospitality

write_if_changed() {
  local path="$1"
  local tmp
  tmp="$(mktemp)"
  cat > "$tmp"
  mkdir -p "$(dirname "$path")"
  if [[ -f "$path" ]] && cmp -s "$tmp" "$path"; then
    rm -f "$tmp"
    echo "UNCHANGED: $path"
  else
    mv "$tmp" "$path"
    echo "WROTE: $path"
  fi
}

# ---- hospitality action types ----
write_if_changed src/exec/executors/hospitality/actions.ts <<'TS'
export type HospitalityAction =
  | "RATE_UPDATE"
  | "TARIFF_SYNC"
  | "VENDOR_INVOICE_CHECK";

export function isHospitalityAction(x: unknown): x is HospitalityAction {
  return x === "RATE_UPDATE" || x === "TARIFF_SYNC" || x === "VENDOR_INVOICE_CHECK";
}
TS

# ---- hospitality input validators (deny-by-default) ----
write_if_changed src/exec/executors/hospitality/validate.ts <<'TS'
import type { HospitalityAction } from "./actions.js";
import { isHospitalityAction } from "./actions.js";

export type RateUpdateInput = Readonly<{
  action: "RATE_UPDATE";
  property_id: string;
  room_type?: string;
  date_start: string; // ISO date
  date_end: string;   // ISO date
  new_rate_cents: number;
  currency: string; // e.g. "USD"
}>;

export type TariffSyncInput = Readonly<{
  action: "TARIFF_SYNC";
  source: "HTS" | "INTERNAL" | "VENDOR";
  effective_date: string; // ISO date
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

function reqString(obj: Record<string, unknown>, key: string): string {
  const v = obj[key];
  if (typeof v !== "string" || v.trim().length === 0) throw new Error(`INPUT_${key.toUpperCase()}_REQUIRED`);
  return v.trim();
}

function reqNumber(obj: Record<string, unknown>, key: string): number {
  const v = obj[key];
  if (typeof v !== "number" || !Number.isFinite(v)) throw new Error(`INPUT_${key.toUpperCase()}_REQUIRED`);
  return v;
}

function reqIsoDate(obj: Record<string, unknown>, key: string): string {
  const s = reqString(obj, key);
  // Minimal ISO date check: YYYY-MM-DD
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) throw new Error(`INPUT_${key.toUpperCase()}_INVALID_DATE`);
  return s;
}

export function validateHospitalityInputs(inputs: unknown): HospitalityInputs {
  if (typeof inputs !== "object" || inputs === null) throw new Error("INPUTS_REQUIRED");
  const obj = inputs as Record<string, unknown>;

  const actionRaw = obj["action"];
  if (!isHospitalityAction(actionRaw)) throw new Error("INPUT_ACTION_INVALID");
  const action = actionRaw as HospitalityAction;

  switch (action) {
    case "RATE_UPDATE": {
      const property_id = reqString(obj, "property_id");
      const date_start = reqIsoDate(obj, "date_start");
      const date_end = reqIsoDate(obj, "date_end");
      const new_rate_cents = reqNumber(obj, "new_rate_cents");
      const currency = reqString(obj, "currency");
      const room_type = typeof obj.room_type === "string" && obj.room_type.trim().length > 0 ? obj.room_type.trim() : undefined;

      return {
        action,
        property_id,
        room_type,
        date_start,
        date_end,
        new_rate_cents,
        currency
      };
    }

    case "TARIFF_SYNC": {
      const source = reqString(obj, "source");
      if (source !== "HTS" && source !== "INTERNAL" && source !== "VENDOR") throw new Error("INPUT_SOURCE_INVALID");
      const effective_date = reqIsoDate(obj, "effective_date");

      const categories =
        Array.isArray(obj.categories)
          ? obj.categories.filter((x): x is string => typeof x === "string").map((s) => s.trim()).filter((s) => s.length > 0)
          : undefined;

      return {
        action,
        source: source as TariffSyncInput["source"],
        effective_date,
        categories
      };
    }

    case "VENDOR_INVOICE_CHECK": {
      const vendor_id = reqString(obj, "vendor_id");
      const invoice_id = reqString(obj, "invoice_id");
      const amount_cents = reqNumber(obj, "amount_cents");
      const currency = reqString(obj, "currency");

      return {
        action,
        vendor_id,
        invoice_id,
        amount_cents,
        currency
      };
    }

    default: {
      const _never: never = action;
      return _never;
    }
  }
}
TS

# ---- hospitality handlers (deterministic stubs) ----
write_if_changed src/exec/executors/hospitality/handlers.ts <<'TS'
import type { HospitalityInputs } from "./validate.js";

export function handleHospitality(inputs: HospitalityInputs): Record<string, unknown> {
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
        flags: [] as string[]
      };

    default: {
      const _never: never = inputs;
      return _never;
    }
  }
}
TS

# ---- upgrade hospitality executor to require action + validate inputs ----
write_if_changed src/exec/executors/hospitality.ts <<'TS'
import type { DomainExecutor, ExecutionResult } from "../types.js";
import type { AgoTask } from "../../task/types.js";
import { validateHospitalityInputs } from "./hospitality/validate.js";
import { handleHospitality } from "./hospitality/handlers.js";

function ok(task: AgoTask, output: Record<string, unknown>): ExecutionResult {
  return {
    status: "OK",
    task_id: task.task_id,
    domain_id: task.domain_id,
    task_type: task.task_type,
    output
  };
}

function err(task: AgoTask, message: string): ExecutionResult {
  return {
    status: "ERROR",
    task_id: task.task_id,
    domain_id: task.domain_id,
    task_type: task.task_type,
    error: message,
    output: { error: message }
  };
}

export const hospitalityExecutor: DomainExecutor = {
  domain_id: "hospitality",
  supports: ["EXECUTE", "ANALYZE", "ESCALATE"],
  execute(task: AgoTask): ExecutionResult {
    try {
      const inputs = validateHospitalityInputs(task.inputs);
      const output = handleHospitality(inputs);
      return ok(task, {
        executor: "hospitalityExecutor",
        mode: "TEMPLATED_STUB",
        ...output
      });
    } catch (e: any) {
      const msg = e?.message ? String(e.message) : "HOSPITALITY_INPUT_INVALID";
      return err(task, msg);
    }
  }
};
TS

npm run build
