export type AuditEventType = "TASK_RECEIVED" | "TASK_VALIDATED" | "TASK_DENIED" | "TASK_DISPATCHED" | "TASK_NOOP_EXECUTED" | "TASK_NO_EXECUTOR" | "TASK_EXECUTED" | "TASK_EXECUTION_FAILED";
export type AuditEvent = Readonly<{
    event_id: string;
    task_id: string;
    event_type: AuditEventType;
    timestamp: string;
    reason?: string;
}>;
