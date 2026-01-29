#!/usr/bin/env bash
set -euo pipefail

mkdir -p src/scope

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

# ---- scope types ----
write_if_changed src/scope/types.ts <<'TS'
export type ScopeCapability =
  | "task:execute"
  | "task:analyze"
  | "task:escalate";

export type ScopeDecision = Readonly<{
  allowed: boolean;
  reason: string;
  missing?: readonly ScopeCapability[];
}>;
TS

# ---- scope enforcement (deny-by-default) ----
write_if_changed src/scope/enforceScope.ts <<'TS'
import type { ScopeCapability, ScopeDecision } from "./types.js";
import type { TaskType } from "../task/types.js";

function decision(
  allowed: boolean,
  reason: string,
  missing?: readonly ScopeCapability[]
): ScopeDecision {
  return missing && missing.length > 0
    ? { allowed, reason, missing }
    : { allowed, reason };
}

function requiredCapsForTaskType(task_type: TaskType): readonly ScopeCapability[] {
  switch (task_type) {
    case "EXECUTE":
      return ["task:execute"];
    case "ANALYZE":
      return ["task:analyze"];
    case "ESCALATE":
      return ["task:escalate"];
    default: {
      // Exhaustiveness guard
      const _never: never = task_type;
      return _never;
    }
  }
}

/**
 * Scope enforcement (v1):
 * - Deny-by-default
 * - Task must include required capability for its task_type
 * - Ignores unknown capabilities (they do not grant permissions)
 */
export function enforceScope(task_type: TaskType, scope: readonly string[]): ScopeDecision {
  if (!Array.isArray(scope) || scope.length === 0) {
    return decision(false, "SCOPE_MISSING", requiredCapsForTaskType(task_type));
  }

  const normalized = new Set(
    scope
      .filter((s): s is string => typeof s === "string")
      .map((s) => s.trim())
      .filter((s) => s.length > 0)
  );

  const required = requiredCapsForTaskType(task_type);
  const missing = required.filter((cap) => !normalized.has(cap));

  if (missing.length > 0) {
    return decision(false, "SCOPE_INSUFFICIENT", missing);
  }

  return decision(true, "SCOPE_OK");
}
TS

# ---- update validateTask to enforce scope after Sentinel auth ----
write_if_changed src/task/validateTask.ts <<'TS'
import type { AgoTask } from "./types.js";
import { authorize } from "../sentinel/authorize.js";
import { enforceScope } from "../scope/enforceScope.js";

function reqString(t: Record<string, unknown>, key: string): string {
  const v = t[key];
  if (typeof v !== "string" || v.trim().length === 0) {
    throw new Error(`${key} required`);
  }
  return v.trim();
}

function reqStringArray(t: Record<string, unknown>, key: string): readonly string[] {
  const v = t[key];
  if (!Array.isArray(v) || v.length === 0) {
    throw new Error(`${key} required`);
  }
  const cleaned = v
    .filter((x): x is string => typeof x === "string")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  if (cleaned.length === 0) {
    throw new Error(`${key} required`);
  }
  return cleaned;
}

export function validateTask(task: unknown): AgoTask {
  if (typeof task !== "object" || task === null) {
    throw new Error("Task must be an object");
  }
  const t = task as Record<string, unknown>;

  reqString(t, "task_id");

  const task_type = reqString(t, "task_type");
  if (!["EXECUTE", "ANALYZE", "ESCALATE"].includes(task_type)) {
    throw new Error("invalid task_type");
  }

  const requested_by = reqString(t, "requested_by");
  const authority_token = reqString(t, "authority_token");
  reqString(t, "created_at");

  const scope = reqStringArray(t, "scope");

  const sentinel_policy_id =
    typeof t.sentinel_policy_id === "string" && t.sentinel_policy_id.trim().length > 0
      ? t.sentinel_policy_id.trim()
      : undefined;

  // 1) Sentinel auth gate (deny-by-default)
  const authDecision = authorize(
    sentinel_policy_id
      ? { authority_token, sentinel_policy_id, requested_by }
      : { authority_token, requested_by }
  );
  if (!authDecision.allowed) {
    throw new Error(`SENTINEL_DENY:${authDecision.reason}`);
  }

  // 2) Scope gate (deny-by-default)
  const scopeDecision = enforceScope(task_type as "EXECUTE" | "ANALYZE" | "ESCALATE", scope);
  if (!scopeDecision.allowed) {
    const missing = scopeDecision.missing ? scopeDecision.missing.join(",") : "";
    throw new Error(`SCOPE_DENY:${scopeDecision.reason}${missing ? ":" + missing : ""}`);
  }

  return t as AgoTask;
}
TS

# ---- export scope types ----
write_if_changed src/index.ts <<'TS'
export * from "./task/validateTask.js";
export * from "./sentinel/authorize.js";
export * from "./sentinel/types.js";
export * from "./scope/enforceScope.js";
export * from "./scope/types.js";
TS

npm run build
