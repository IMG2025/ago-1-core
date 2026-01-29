#!/usr/bin/env bash
set -euo pipefail

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

# -------- sentinel/types.ts (unchanged shape, but clarified intent) --------
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

# -------- sentinel/authorize.ts (omit optional fields when undefined) --------
write_if_changed src/sentinel/authorize.ts <<'TS'
import type { SentinelAuthDecision, SentinelAuthRequest } from "./types.js";

function decision(
  allowed: boolean,
  reason: string,
  policy_id?: string
): SentinelAuthDecision {
  return policy_id
    ? { allowed, reason, policy_id }
    : { allowed, reason };
}

/**
 * Sentinel authorization stub (v0):
 * - No crypto
 * - No network
 * - Deterministic
 * - Deny-by-default
 */
export function authorize(req: SentinelAuthRequest): SentinelAuthDecision {
  const token = (req.authority_token ?? "").trim();
  if (token.length === 0) {
    return decision(false, "MISSING_TOKEN");
  }

  const m = /^SENTINEL:([A-Za-z0-9_.-]{3,64}):(.{10,})$/.exec(token);
  if (!m) {
    return decision(false, "TOKEN_FORMAT_INVALID");
  }

  const policy_id = m[1];

  if (req.sentinel_policy_id && req.sentinel_policy_id !== policy_id) {
    return decision(false, "POLICY_ID_MISMATCH", policy_id);
  }

  return decision(true, "ALLOW_FORMAT_OK", policy_id);
}
TS

# -------- task/validateTask.ts (pass only defined fields) --------
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

  const task_id = reqString(t, "task_id");
  const task_type = reqString(t, "task_type");
  if (!["EXECUTE", "ANALYZE", "ESCALATE"].includes(task_type)) {
    throw new Error("invalid task_type");
  }

  const requested_by = reqString(t, "requested_by");
  const authority_token = reqString(t, "authority_token");
  reqString(t, "created_at");

  const sentinel_policy_id =
    typeof t.sentinel_policy_id === "string" && t.sentinel_policy_id.trim().length > 0
      ? t.sentinel_policy_id.trim()
      : undefined;

  const decision = authorize(
    sentinel_policy_id
      ? { authority_token, sentinel_policy_id, requested_by }
      : { authority_token, requested_by }
  );

  if (!decision.allowed) {
    throw new Error(`SENTINEL_DENY:${decision.reason}`);
  }

  return t as AgoTask;
}
TS

npm run build
