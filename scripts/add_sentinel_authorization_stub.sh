#!/usr/bin/env bash
set -euo pipefail

mkdir -p src/sentinel src/task

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

# ---- Sentinel authorization result types ----
write_if_changed src/sentinel/types.ts <<'TS'
export type SentinelAuthDecision = Readonly<{
  allowed: boolean;
  reason: string;
  policy_id?: string;
}>;

export type SentinelAuthRequest = Readonly<{
  authority_token: string;
  sentinel_policy_id?: string;
  requested_by?: string;
}>;
TS

# ---- Sentinel authorize stub: deny-by-default unless token format passes ----
write_if_changed src/sentinel/authorize.ts <<'TS'
import type { SentinelAuthDecision, SentinelAuthRequest } from "./types.js";

/**
 * Sentinel authorization stub (v0):
 * - No crypto
 * - No network
 * - No secrets
 * - Deterministic, deny-by-default
 *
 * Accepts only tokens that match a strict format:
 *   "SENTINEL:<policy_id>:<opaque>"
 *
 * Everything else is denied.
 */
export function authorize(req: SentinelAuthRequest): SentinelAuthDecision {
  const token = (req.authority_token ?? "").trim();
  if (token.length === 0) {
    return { allowed: false, reason: "MISSING_TOKEN" };
  }

  // Strict token shape gate (format only, not validity):
  // SENTINEL:<policy_id>:<opaque>
  const m = /^SENTINEL:([A-Za-z0-9_.-]{3,64}):(.{10,})$/.exec(token);
  if (!m) {
    return { allowed: false, reason: "TOKEN_FORMAT_INVALID" };
  }

  const policy_id = m[1];

  // Optional: if task provided a policy_id, require match
  if (req.sentinel_policy_id && req.sentinel_policy_id !== policy_id) {
    return { allowed: false, reason: "POLICY_ID_MISMATCH", policy_id };
  }

  return { allowed: true, reason: "ALLOW_FORMAT_OK", policy_id };
}
TS

# ---- Update task types to include sentinel_policy_id (optional but recommended) ----
write_if_changed src/task/types.ts <<'TS'
export type TaskType = "EXECUTE" | "ANALYZE" | "ESCALATE";

export type AgoTask = Readonly<{
  task_id: string;
  task_type: TaskType;
  requested_by: string;
  authority_token: string;
  sentinel_policy_id?: string;
  scope: readonly string[];
  inputs: Record<string, unknown>;
  created_at: string;
}>;
TS

# ---- Update validator to enforce deny-by-default + required fields ----
write_if_changed src/task/validateTask.ts <<'TS'
import type { AgoTask } from "./types.js";
import { authorize } from "../sentinel/authorize.js";

function reqString(t: Record<string, unknown>, key: string): string {
  const v = t[key];
  if (typeof v !== "string" || v.trim().length === 0) {
    throw new Error(`${key} required`);
  }
  return v.trim();
}

export function validateTask(task: unknown): AgoTask {
  if (typeof task !== "object" || task === null) {
    throw new Error("Task must be an object");
  }
  const t = task as Record<string, unknown>;

  // Required fields (core)
  reqString(t, "task_id");
  const task_type = reqString(t, "task_type");
  if (!["EXECUTE", "ANALYZE", "ESCALATE"].includes(task_type)) {
    throw new Error("invalid task_type");
  }
  reqString(t, "requested_by");
  const authority_token = reqString(t, "authority_token");
  reqString(t, "created_at");

  // Recommended fields
  const sentinel_policy_id =
    typeof t.sentinel_policy_id === "string" && t.sentinel_policy_id.trim().length > 0
      ? t.sentinel_policy_id.trim()
      : undefined;

  // Deny-by-default authorization gate (format-only for now)
  const decision = authorize({ authority_token, sentinel_policy_id, requested_by: String(t.requested_by) });
  if (!decision.allowed) {
    throw new Error(`SENTINEL_DENY:${decision.reason}`);
  }

  return t as AgoTask;
}
TS

# ---- Export sentinel module from entry ----
write_if_changed src/index.ts <<'TS'
export * from "./task/validateTask.js";
export * from "./sentinel/authorize.js";
export * from "./sentinel/types.js";
TS

npm run build
