import type { AuditEvent } from "./types.js";
/**
 * Append-only audit writer.
 * Fail-closed: if we cannot append, caller must treat as fatal.
 */
export declare function appendAuditEvent(evt: AuditEvent): void;
