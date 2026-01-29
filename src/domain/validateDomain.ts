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
