export declare function intakeAndDispatch(task: unknown): Readonly<{
    status: import("./types.js").ExecutionStatus;
    task_id: string;
    domain_id: string;
    task_type: import("../task/types.js").TaskType;
    output?: Record<string, unknown>;
    error?: string;
}>;
