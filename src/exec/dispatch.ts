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
