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
