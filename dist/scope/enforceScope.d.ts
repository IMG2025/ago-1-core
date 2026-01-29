import type { ScopeDecision } from "./types.js";
import type { TaskType } from "../task/types.js";
/**
 * Scope enforcement (v1):
 * - Deny-by-default
 * - Task must include required capability for its task_type
 * - Ignores unknown capabilities (they do not grant permissions)
 */
export declare function enforceScope(task_type: TaskType, scope: readonly string[]): ScopeDecision;
