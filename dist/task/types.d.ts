export type TaskType = "EXECUTE" | "ANALYZE" | "ESCALATE";
export type AgoTask = Readonly<{
    task_id: string;
    domain_id: string;
    task_type: TaskType;
    requested_by: string;
    authority_token: string;
    sentinel_policy_id?: string;
    scope: readonly string[];
    inputs: Record<string, unknown>;
    created_at: string;
}>;
