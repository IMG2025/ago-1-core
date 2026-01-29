import type { AgoTask } from "../task/types.js";
import type { ExecutionResult } from "./types.js";
import "./builtins.js";
/**
 * Dispatcher:
 * - Audits dispatch
 * - Routes to registered domain executor if present
 * - If missing executor: audits TASK_NO_EXECUTOR and returns NOOP (fail closed, no side effects)
 */
export declare function dispatch(task: AgoTask): ExecutionResult;
