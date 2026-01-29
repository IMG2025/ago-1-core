import { appendAuditEvent } from "./writer.js";
import { newEventId } from "./id.js";
function nowIso() {
    return new Date().toISOString();
}
export function logAudit(task_id, event_type, reason) {
    appendAuditEvent({
        event_id: newEventId(),
        task_id,
        event_type,
        timestamp: nowIso(),
        ...(reason ? { reason } : {})
    });
}
