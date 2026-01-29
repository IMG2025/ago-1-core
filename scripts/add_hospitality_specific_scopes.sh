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

# ---- tighten hospitality domain manifest: require hospitality:execute for any EXECUTE ----
write_if_changed domains/hospitality/domain.json <<'JSON'
{
  "domain_id": "hospitality",
  "owner": "CHC",
  "status": "ACTIVE",
  "supported_task_types": ["EXECUTE", "ANALYZE", "ESCALATE"],
  "required_scopes": {
    "EXECUTE": ["task:execute", "hospitality:execute"],
    "ANALYZE": ["task:analyze"],
    "ESCALATE": ["task:escalate"]
  }
}
JSON

# ---- action → required scopes mapping (least privilege) ----
write_if_changed src/exec/executors/hospitality/scopes.ts <<'TS'
import type { HospitalityInputs } from "./validate.js";

export type MissingScopes = Readonly<{
  allowed: boolean;
  missing?: readonly string[];
}>;

function hasAll(scopes: readonly string[], required: readonly string[]): MissingScopes {
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
export function enforceHospitalityActionScopes(
  actionInputs: HospitalityInputs,
  taskScopes: readonly string[]
): MissingScopes {
  const base = hasAll(taskScopes, ["hospitality:execute"]);
  if (!base.allowed) return base;

  switch (actionInputs.action) {
    case "RATE_UPDATE":
      return hasAll(taskScopes, ["hospitality:rates:write"]);
    case "TARIFF_SYNC":
      return hasAll(taskScopes, ["hospitality:tariffs:sync"]);
    case "VENDOR_INVOICE_CHECK":
      return hasAll(taskScopes, ["hospitality:invoices:review"]);
    default: {
      const _never: never = actionInputs;
      return _never;
    }
  }
}
TS

# ---- update hospitality executor to enforce action scopes ----
write_if_changed src/exec/executors/hospitality.ts <<'TS'
import type { DomainExecutor, ExecutionResult } from "../types.js";
import type { AgoTask } from "../../task/types.js";
import { validateHospitalityInputs } from "./hospitality/validate.js";
import { handleHospitality } from "./hospitality/handlers.js";
import { enforceHospitalityActionScopes } from "./hospitality/scopes.js";

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

      // Action-level least-privilege scope enforcement
      const scopeDecision = enforceHospitalityActionScopes(inputs, task.scope);
      if (!scopeDecision.allowed) {
        const missing = scopeDecision.missing ? scopeDecision.missing.join(",") : "";
        return err(task, `HOSPITALITY_SCOPE_INSUFFICIENT:${missing}`);
      }

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
