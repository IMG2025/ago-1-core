#!/usr/bin/env bash
set -euo pipefail

mkdir -p src/exec src/audit

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

# ---- expand audit event types to include dispatch + noop ----
write_if_changed src/audit/types.ts <<'TS'
export type AuditEventType =
  | "TASK_RECEIVED"
  | "TASK_VALIDATED"
  | "TASK_DENIED"
  | "TASK_DISPATCHED"
  | "TASK_NOOP_EXECUTED";

export type AuditEvent = Readonly<{
  event_id: string;
  task_id: string;
  event_type: AuditEventType;
  timestamp: string; // ISO-8601
  reason?: string;
}>;
TS

# ---- audit helper (shared) ----
write_if_changed src/audit/log.ts <<'TS'
import { appendAuditEvent } from "./writer.js";
import { newEventId } from "./id.js";
import type { AuditEventType } from "./types.js";

function nowIso(): string {
  return new Date().toISOString();
}

export function logAudit(task_id: string, event_type: AuditEventType, reason?: string): void {
  appendAuditEvent({
    event_id: newEventId(),
    task_id,
    event_type,
    timestamp: nowIso(),
    ...(reason ? { reason } : {})
  });
}
TS

# ---- execution skeleton (NOOP) ----
write_if_changed src/exec/dispatch.ts <<'TS'
import type { AgoTask } from "../task/types.js";
import { logAudit } from "../audit/log.js";

/**
 * Execution skeleton:
 * - No side effects
 * - Deterministic audit trail
 * - Domain execution engine will plug in later
 */
export function dispatch(task: AgoTask): { status: "NOOP"; task_id: string } {
  logAudit(task.task_id, "TASK_DISPATCHED", `${task.domain_id}:${task.task_type}`);

  // NOOP execution placeholder (proves control-plane flow)
  logAudit(task.task_id, "TASK_NOOP_EXECUTED", "NOOP_EXECUTION_SKELETON");

  return { status: "NOOP", task_id: task.task_id };
}
TS

# ---- intake: validate + dispatch (optional convenience API) ----
write_if_changed src/exec/intake.ts <<'TS'
import { validateTask } from "../task/validateTask.js";
import { dispatch } from "./dispatch.js";

export function intakeAndDispatch(task: unknown) {
  const validated = validateTask(task);
  return dispatch(validated);
}
TS

# ---- update validateTask to use shared audit helper (no behavior change) ----
write_if_changed src/task/validateTask.ts <<'TS'
import type { AgoTask } from "./types.js";
import { authorize } from "../sentinel/authorize.js";
import { enforceScope } from "../scope/enforceScope.js";
import { TaskDeniedError } from "./errors.js";
import { loadDomainManifest } from "../domain/loadManifest.js";
import { validateDomainForTask } from "../domain/validateDomain.js";
import { logAudit } from "../audit/log.js";

function reqString(t: Record<string, unknown>, key: string): string {
  const v = t[key];
  if (typeof v !== "string" || v.trim().length === 0) {
    throw new TaskDeniedError("SCHEMA_INVALID", `${key} required`);
  }
  return v.trim();
}

function reqStringArray(t: Record<string, unknown>, key: string): readonly string[] {
  const v = t[key];
  if (!Array.isArray(v) || v.length === 0) {
    throw new TaskDeniedError("SCHEMA_INVALID", `${key} required`);
  }
  const cleaned = v
    .filter((x): x is string => typeof x === "string")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  if (cleaned.length === 0) {
    throw new TaskDeniedError("SCHEMA_INVALID", `${key} required`);
  }
  return cleaned;
}

export function validateTask(task: unknown): AgoTask {
  const task_id =
    typeof task === "object" && task !== null && typeof (task as any).task_id === "string"
      ? String((task as any).task_id)
      : "UNKNOWN_TASK";

  logAudit(task_id, "TASK_RECEIVED");

  try {
    if (typeof task !== "object" || task === null) {
      throw new TaskDeniedError("SCHEMA_INVALID", "Task must be an object");
    }
    const t = task as Record<string, unknown>;

    reqString(t, "task_id");
    const domain_id = reqString(t, "domain_id");

    const task_type = reqString(t, "task_type");
    if (!["EXECUTE", "ANALYZE", "ESCALATE"].includes(task_type)) {
      throw new TaskDeniedError("SCHEMA_INVALID", "invalid task_type");
    }

    const requested_by = reqString(t, "requested_by");
    const authority_token = reqString(t, "authority_token");
    reqString(t, "created_at");
    const scope = reqStringArray(t, "scope");

    // 0) Domain registration gate
    const manifest = loadDomainManifest(domain_id);
    const domDecision = validateDomainForTask(manifest, task_type as "EXECUTE" | "ANALYZE" | "ESCALATE", scope);
    if (!domDecision.allowed) {
      const missing = domDecision.missing ? domDecision.missing.join(",") : "";
      throw new TaskDeniedError("DOMAIN_DENY", `${domDecision.reason}${missing ? ":" + missing : ""}`);
    }

    const sentinel_policy_id =
      typeof t.sentinel_policy_id === "string" && t.sentinel_policy_id.trim().length > 0
        ? t.sentinel_policy_id.trim()
        : undefined;

    // 1) Sentinel auth gate
    const authDecision = authorize(
      sentinel_policy_id
        ? { authority_token, sentinel_policy_id, requested_by }
        : { authority_token, requested_by }
    );
    if (!authDecision.allowed) {
      throw new TaskDeniedError("SENTINEL_DENY", authDecision.reason);
    }

    // 2) Global scope gate
    const scopeDecision = enforceScope(task_type as "EXECUTE" | "ANALYZE" | "ESCALATE", scope);
    if (!scopeDecision.allowed) {
      const missing = scopeDecision.missing ? scopeDecision.missing.join(",") : "";
      throw new TaskDeniedError("SCOPE_DENY", `${scopeDecision.reason}${missing ? ":" + missing : ""}`);
    }

    logAudit(task_id, "TASK_VALIDATED");
    return t as AgoTask;
  } catch (e: any) {
    const msg = e?.message ? String(e.message) : "UNKNOWN_ERROR";
    logAudit(task_id, "TASK_DENIED", msg);
    throw e;
  }
}
TS

# ---- export exec APIs ----
write_if_changed src/index.ts <<'TS'
export * from "./task/validateTask.js";
export * from "./task/errors.js";
export * from "./sentinel/authorize.js";
export * from "./sentinel/types.js";
export * from "./scope/enforceScope.js";
export * from "./scope/types.js";
export * from "./audit/writer.js";
export * from "./audit/types.js";
export * from "./audit/log.js";
export * from "./domain/loadManifest.js";
export * from "./domain/validateDomain.js";
export * from "./domain/types.js";
export * from "./exec/dispatch.js";
export * from "./exec/intake.js";
TS

npm run build
