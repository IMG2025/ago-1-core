import { appendAuditEvent } from "./writer.js";
import { newEventId } from "./id.js";
import type { AuditEventType } from "./types.js";

function nowIso(): string {
  return new Date().toISOString();
}

export function logAudit(task_id: string, event_type: AuditEventType, reason?: string): void {
  appendAuditEvent({
    event_id: newEventId(),
    task_id,
    event_type,
    timestamp: nowIso(),
    ...(reason ? { reason } : {})
  });
}
