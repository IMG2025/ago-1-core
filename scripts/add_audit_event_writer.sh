#!/usr/bin/env bash
set -euo pipefail

mkdir -p src/audit src/task audit

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

# ---- audit types ----
write_if_changed src/audit/types.ts <<'TS'
export type AuditEventType = "TASK_RECEIVED" | "TASK_VALIDATED" | "TASK_DENIED";

export type AuditEvent = Readonly<{
  event_id: string;
  task_id: string;
  event_type: AuditEventType;
  timestamp: string; // ISO-8601
  reason?: string;
}>;
TS

# ---- uuid-ish generator (deterministic format, not cryptographic) ----
write_if_changed src/audit/id.ts <<'TS'
/**
 * Non-cryptographic event id generator.
 * We can replace with crypto.randomUUID() later when stable across runtimes.
 */
export function newEventId(): string {
  const now = Date.now().toString(16);
  const rnd = Math.floor(Math.random() * 1e16).toString(16).padStart(12, "0");
  return `evt_${now}_${rnd}`;
}
TS

# ---- audit writer (append-only JSONL) ----
write_if_changed src/audit/writer.ts <<'TS'
import fs from "node:fs";
import path from "node:path";
import type { AuditEvent } from "./types.js";

const AUDIT_DIR = "audit";
const AUDIT_FILE = "events.log";

function ensureAuditPath(): string {
  const dir = path.resolve(process.cwd(), AUDIT_DIR);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return path.join(dir, AUDIT_FILE);
}

/**
 * Append-only audit writer.
 * Fail-closed: if we cannot append, caller must treat as fatal.
 */
export function appendAuditEvent(evt: AuditEvent): void {
  const p = ensureAuditPath();
  const line = JSON.stringify(evt) + "\n";
  fs.appendFileSync(p, line, { encoding: "utf8" });
}
TS

# ---- task error type (explicit denial semantics) ----
write_if_changed src/task/errors.ts <<'TS'
export class TaskDeniedError extends Error {
  public readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "TaskDeniedError";
    this.code = code;
  }
}
TS

# ---- wire audit into validateTask (RECEIVED -> VALIDATED|DENIED) ----
write_if_changed src/task/validateTask.ts <<'TS'
import type { AgoTask } from "./types.js";
import { authorize } from "../sentinel/authorize.js";
import { enforceScope } from "../scope/enforceScope.js";
import { appendAuditEvent } from "../audit/writer.js";
import { newEventId } from "../audit/id.js";
import type { AuditEventType } from "../audit/types.js";
import { TaskDeniedError } from "./errors.js";

function nowIso(): string {
  return new Date().toISOString();
}

function audit(task_id: string, event_type: AuditEventType, reason?: string): void {
  appendAuditEvent({
    event_id: newEventId(),
    task_id,
    event_type,
    timestamp: nowIso(),
    ...(reason ? { reason } : {})
  });
}

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
  // We need a task_id early for audit correlation.
  const task_id =
    typeof task === "object" && task !== null && typeof (task as any).task_id === "string"
      ? String((task as any).task_id)
      : "UNKNOWN_TASK";

  audit(task_id, "TASK_RECEIVED");

  try {
    if (typeof task !== "object" || task === null) {
      throw new TaskDeniedError("SCHEMA_INVALID", "Task must be an object");
    }
    const t = task as Record<string, unknown>;

    reqString(t, "task_id");

    const task_type = reqString(t, "task_type");
    if (!["EXECUTE", "ANALYZE", "ESCALATE"].includes(task_type)) {
      throw new TaskDeniedError("SCHEMA_INVALID", "invalid task_type");
    }

    const requested_by = reqString(t, "requested_by");
    const authority_token = reqString(t, "authority_token");
    reqString(t, "created_at");
    const scope = reqStringArray(t, "scope");

    const sentinel_policy_id =
      typeof t.sentinel_policy_id === "string" && t.sentinel_policy_id.trim().length > 0
        ? t.sentinel_policy_id.trim()
        : undefined;

    const authDecision = authorize(
      sentinel_policy_id
        ? { authority_token, sentinel_policy_id, requested_by }
        : { authority_token, requested_by }
    );
    if (!authDecision.allowed) {
      throw new TaskDeniedError("SENTINEL_DENY", authDecision.reason);
    }

    const scopeDecision = enforceScope(task_type as "EXECUTE" | "ANALYZE" | "ESCALATE", scope);
    if (!scopeDecision.allowed) {
      const missing = scopeDecision.missing ? scopeDecision.missing.join(",") : "";
      throw new TaskDeniedError("SCOPE_DENY", `${scopeDecision.reason}${missing ? ":" + missing : ""}`);
    }

    audit(task_id, "TASK_VALIDATED");
    return t as AgoTask;
  } catch (e: any) {
    const msg = e?.message ? String(e.message) : "UNKNOWN_ERROR";
    audit(task_id, "TASK_DENIED", msg);
    throw e;
  }
}
TS

# ---- export TaskDeniedError ----
write_if_changed src/index.ts <<'TS'
export * from "./task/validateTask.js";
export * from "./task/errors.js";
export * from "./sentinel/authorize.js";
export * from "./sentinel/types.js";
export * from "./scope/enforceScope.js";
export * from "./scope/types.js";
export * from "./audit/writer.js";
export * from "./audit/types.js";
TS

npm run build
