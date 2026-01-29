import fs from "node:fs";
import path from "node:path";
import type { AuditEvent } from "./types.js";

const AUDIT_DIR = "audit";
const AUDIT_FILE = "events.log";

function ensureAuditPath(): string {
  const dir = path.resolve(process.cwd(), AUDIT_DIR);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return path.join(dir, AUDIT_FILE);
}

/**
 * Append-only audit writer.
 * Fail-closed: if we cannot append, caller must treat as fatal.
 */
export function appendAuditEvent(evt: AuditEvent): void {
  const p = ensureAuditPath();
  const line = JSON.stringify(evt) + "\n";
  fs.appendFileSync(p, line, { encoding: "utf8" });
}
