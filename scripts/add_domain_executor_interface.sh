#!/usr/bin/env bash
set -euo pipefail

mkdir -p src/exec/executors src/exec src/audit

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

# ---- expand audit event types to include executor outcomes ----
write_if_changed src/audit/types.ts <<'TS'
export type AuditEventType =
  | "TASK_RECEIVED"
  | "TASK_VALIDATED"
  | "TASK_DENIED"
  | "TASK_DISPATCHED"
  | "TASK_NOOP_EXECUTED"
  | "TASK_NO_EXECUTOR"
  | "TASK_EXECUTED"
  | "TASK_EXECUTION_FAILED";

export type AuditEvent = Readonly<{
  event_id: string;
  task_id: string;
  event_type: AuditEventType;
  timestamp: string; // ISO-8601
  reason?: string;
}>;
TS

# ---- execution contract types ----
write_if_changed src/exec/types.ts <<'TS'
import type { AgoTask, TaskType } from "../task/types.js";

export type ExecutionStatus = "NOOP" | "OK" | "ERROR";

export type ExecutionResult = Readonly<{
  status: ExecutionStatus;
  task_id: string;
  domain_id: string;
  task_type: TaskType;
  output?: Record<string, unknown>;
  error?: string;
}>;

export type DomainExecutor = Readonly<{
  domain_id: string;
  supports: readonly TaskType[];
  execute: (task: AgoTask) => ExecutionResult;
}>;
TS

# ---- executor registry (fail-closed if none) ----
write_if_changed src/exec/registry.ts <<'TS'
import type { DomainExecutor } from "./types.js";

const REGISTRY = new Map<string, DomainExecutor>();

export function registerExecutor(executor: DomainExecutor): void {
  const id = executor.domain_id.trim();
  if (id.length === 0) throw new Error("EXECUTOR_DOMAIN_ID_REQUIRED");
  if (REGISTRY.has(id)) throw new Error(`EXECUTOR_ALREADY_REGISTERED:${id}`);
  REGISTRY.set(id, executor);
}

export function getExecutor(domain_id: string): DomainExecutor | undefined {
  return REGISTRY.get(domain_id.trim());
}

export function listExecutors(): readonly string[] {
  return Array.from(REGISTRY.keys()).sort();
}
TS

# ---- built-in hospitality executor stub (deterministic, no side effects) ----
write_if_changed src/exec/executors/hospitality.ts <<'TS'
import type { DomainExecutor, ExecutionResult } from "../types.js";
import type { AgoTask } from "../../task/types.js";

function ok(task: AgoTask, output: Record<string, unknown>): ExecutionResult {
  return {
    status: "OK",
    task_id: task.task_id,
    domain_id: task.domain_id,
    task_type: task.task_type,
    output
  };
}

export const hospitalityExecutor: DomainExecutor = {
  domain_id: "hospitality",
  supports: ["EXECUTE", "ANALYZE", "ESCALATE"],
  execute(task: AgoTask): ExecutionResult {
    // Deterministic stub output. No network, no filesystem mutation.
    // Later: swap this to call domain-specific handlers based on task.inputs.action, etc.
    return ok(task, {
      executor: "hospitalityExecutor",
      mode: "STUB",
      received_inputs_keys: Object.keys(task.inputs ?? {})
    });
  }
};
TS

# ---- builtins loader (register once, deterministic) ----
write_if_changed src/exec/builtins.ts <<'TS'
import { registerExecutor } from "./registry.js";
import { hospitalityExecutor } from "./executors/hospitality.js";

// Register built-in executors (deterministic).
// If we ever want "no built-ins", we can remove this import from dispatch.
registerExecutor(hospitalityExecutor);
TS

# ---- dispatch upgraded: use executor if present else fail closed into audited NOOP ----
write_if_changed src/exec/dispatch.ts <<'TS'
import type { AgoTask } from "../task/types.js";
import type { ExecutionResult } from "./types.js";
import { logAudit } from "../audit/log.js";
import { getExecutor } from "./registry.js";
import "./builtins.js";

function noop(task: AgoTask, reason: string): ExecutionResult {
  return {
    status: "NOOP",
    task_id: task.task_id,
    domain_id: task.domain_id,
    task_type: task.task_type,
    output: { reason }
  };
}

/**
 * Dispatcher:
 * - Audits dispatch
 * - Routes to registered domain executor if present
 * - If missing executor: audits TASK_NO_EXECUTOR and returns NOOP (fail closed, no side effects)
 */
export function dispatch(task: AgoTask): ExecutionResult {
  logAudit(task.task_id, "TASK_DISPATCHED", `${task.domain_id}:${task.task_type}`);

  const exec = getExecutor(task.domain_id);
  if (!exec) {
    logAudit(task.task_id, "TASK_NO_EXECUTOR", task.domain_id);
    logAudit(task.task_id, "TASK_NOOP_EXECUTED", "NO_EXECUTOR_REGISTERED");
    return noop(task, "NO_EXECUTOR_REGISTERED");
  }

  if (!exec.supports.includes(task.task_type)) {
    logAudit(task.task_id, "TASK_EXECUTION_FAILED", `UNSUPPORTED_TASK_TYPE:${task.task_type}`);
    logAudit(task.task_id, "TASK_NOOP_EXECUTED", "EXECUTOR_UNSUPPORTED_TASK_TYPE");
    return noop(task, "EXECUTOR_UNSUPPORTED_TASK_TYPE");
  }

  try {
    const res = exec.execute(task);
    logAudit(task.task_id, "TASK_EXECUTED", `${res.status}`);
    return res;
  } catch (e: any) {
    const msg = e?.message ? String(e.message) : "UNKNOWN_EXECUTION_ERROR";
    logAudit(task.task_id, "TASK_EXECUTION_FAILED", msg);
    logAudit(task.task_id, "TASK_NOOP_EXECUTED", "EXECUTOR_THROW");
    return noop(task, "EXECUTOR_THROW");
  }
}
TS

# ---- intake stays: validate then dispatch ----
write_if_changed src/exec/intake.ts <<'TS'
import { validateTask } from "../task/validateTask.js";
import { dispatch } from "./dispatch.js";

export function intakeAndDispatch(task: unknown) {
  const validated = validateTask(task);
  return dispatch(validated);
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
export * from "./exec/types.js";
export * from "./exec/registry.js";
export * from "./exec/dispatch.js";
export * from "./exec/intake.js";
TS

npm run build
