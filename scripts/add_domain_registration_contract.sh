#!/usr/bin/env bash
set -euo pipefail

mkdir -p src/domain domains/ciag domains/hospitality

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

# ---- Domain manifest types ----
write_if_changed src/domain/types.ts <<'TS'
import type { TaskType } from "../task/types.js";
import type { ScopeCapability } from "../scope/types.js";

export type DomainStatus = "ACTIVE" | "FROZEN";

export type DomainManifest = Readonly<{
  domain_id: string;
  owner: string;
  status: DomainStatus;
  supported_task_types: readonly TaskType[];
  required_scopes: Readonly<Record<TaskType, readonly ScopeCapability[]>>;
}>;
TS

# ---- Domain loader (reads domains/<id>/domain.json) ----
write_if_changed src/domain/loadManifest.ts <<'TS'
import fs from "node:fs";
import path from "node:path";
import type { DomainManifest } from "./types.js";

export function loadDomainManifest(domain_id: string): DomainManifest {
  const clean = domain_id.trim();
  if (clean.length === 0) {
    throw new Error("DOMAIN_ID_REQUIRED");
  }

  const p = path.resolve(process.cwd(), "domains", clean, "domain.json");
  if (!fs.existsSync(p)) {
    throw new Error(`DOMAIN_NOT_REGISTERED:${clean}`);
  }

  const raw = fs.readFileSync(p, "utf8");
  const parsed = JSON.parse(raw) as DomainManifest;

  if (!parsed || typeof parsed !== "object") {
    throw new Error(`DOMAIN_MANIFEST_INVALID:${clean}`);
  }
  if (parsed.domain_id !== clean) {
    throw new Error(`DOMAIN_MANIFEST_MISMATCH:${clean}`);
  }

  return parsed;
}
TS

# ---- Domain validation ----
write_if_changed src/domain/validateDomain.ts <<'TS'
import type { TaskType } from "../task/types.js";
import type { ScopeCapability } from "../scope/types.js";
import type { DomainManifest } from "./types.js";

export type DomainDecision = Readonly<{
  allowed: boolean;
  reason: string;
  missing?: readonly ScopeCapability[];
}>;

function decision(allowed: boolean, reason: string, missing?: readonly ScopeCapability[]): DomainDecision {
  return missing && missing.length > 0 ? { allowed, reason, missing } : { allowed, reason };
}

export function validateDomainForTask(
  manifest: DomainManifest,
  task_type: TaskType,
  scope: readonly string[]
): DomainDecision {
  // Supported task types gate
  if (!manifest.supported_task_types.includes(task_type)) {
    return decision(false, `DOMAIN_TASKTYPE_UNSUPPORTED:${manifest.domain_id}:${task_type}`);
  }

  // Required scopes gate (domain-level)
  const required = manifest.required_scopes[task_type] ?? [];
  const normalized = new Set(
    scope
      .filter((s): s is string => typeof s === "string")
      .map((s) => s.trim())
      .filter((s) => s.length > 0)
  );

  const missing = required.filter((cap) => !normalized.has(cap));
  if (missing.length > 0) {
    return decision(false, `DOMAIN_SCOPE_INSUFFICIENT:${manifest.domain_id}:${task_type}`, missing);
  }

  return decision(true, "DOMAIN_OK");
}
TS

# ---- Update task types: add domain_id (required) ----
write_if_changed src/task/types.ts <<'TS'
export type TaskType = "EXECUTE" | "ANALYZE" | "ESCALATE";

export type AgoTask = Readonly<{
  task_id: string;
  domain_id: string;
  task_type: TaskType;
  requested_by: string;
  authority_token: string;
  sentinel_policy_id?: string;
  scope: readonly string[];
  inputs: Record<string, unknown>;
  created_at: string;
}>;
TS

# ---- Wire domain gate into validateTask ----
write_if_changed src/task/validateTask.ts <<'TS'
import type { AgoTask } from "./types.js";
import { authorize } from "../sentinel/authorize.js";
import { enforceScope } from "../scope/enforceScope.js";
import { appendAuditEvent } from "../audit/writer.js";
import { newEventId } from "../audit/id.js";
import type { AuditEventType } from "../audit/types.js";
import { TaskDeniedError } from "./errors.js";
import { loadDomainManifest } from "../domain/loadManifest.js";
import { validateDomainForTask } from "../domain/validateDomain.js";

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
    const domain_id = reqString(t, "domain_id");

    const task_type = reqString(t, "task_type");
    if (!["EXECUTE", "ANALYZE", "ESCALATE"].includes(task_type)) {
      throw new TaskDeniedError("SCHEMA_INVALID", "invalid task_type");
    }

    const requested_by = reqString(t, "requested_by");
    const authority_token = reqString(t, "authority_token");
    reqString(t, "created_at");
    const scope = reqStringArray(t, "scope");

    // 0) Domain registration gate (fail closed)
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

    audit(task_id, "TASK_VALIDATED");
    return t as AgoTask;
  } catch (e: any) {
    const msg = e?.message ? String(e.message) : "UNKNOWN_ERROR";
    audit(task_id, "TASK_DENIED", msg);
    throw e;
  }
}
TS

# ---- Domain manifests (initial conservative policy) ----
write_if_changed domains/ciag/domain.json <<'JSON'
{
  "domain_id": "ciag",
  "owner": "CIAG",
  "status": "FROZEN",
  "supported_task_types": ["ANALYZE", "ESCALATE"],
  "required_scopes": {
    "EXECUTE": [],
    "ANALYZE": ["task:analyze"],
    "ESCALATE": ["task:escalate"]
  }
}
JSON

write_if_changed domains/hospitality/domain.json <<'JSON'
{
  "domain_id": "hospitality",
  "owner": "CHC",
  "status": "ACTIVE",
  "supported_task_types": ["ANALYZE", "ESCALATE"],
  "required_scopes": {
    "EXECUTE": [],
    "ANALYZE": ["task:analyze"],
    "ESCALATE": ["task:escalate"]
  }
}
JSON

# ---- Export domain APIs ----
write_if_changed src/index.ts <<'TS'
export * from "./task/validateTask.js";
export * from "./task/errors.js";
export * from "./sentinel/authorize.js";
export * from "./sentinel/types.js";
export * from "./scope/enforceScope.js";
export * from "./scope/types.js";
export * from "./audit/writer.js";
export * from "./audit/types.js";
export * from "./domain/loadManifest.js";
export * from "./domain/validateDomain.js";
export * from "./domain/types.js";
TS

npm run build
