#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

function run(cmd) { execSync(cmd, { stdio: "inherit" }); }
function sh(cmd) { return execSync(cmd, { encoding: "utf8" }).trim(); }

const ROOT = sh("git rev-parse --show-toplevel");
const p = (...xs) => path.join(ROOT, ...xs);

function exists(fp) { return fs.existsSync(fp); }
function read(fp) { return fs.readFileSync(fp, "utf8"); }
function mkdirp(dir) { fs.mkdirSync(dir, { recursive: true }); }

function writeIfChanged(fp, next) {
  const prev = exists(fp) ? read(fp) : "";
  if (prev === next) return false;
  mkdirp(path.dirname(fp));
  fs.writeFileSync(fp, next);
  return true;
}

function ensureLineInFile(fp, line) {
  const prev = exists(fp) ? read(fp) : "";
  if (prev.split(/\r?\n/).includes(line)) return false;
  const next = prev.length ? (prev.replace(/\s*$/, "") + "\n" + line + "\n") : (line + "\n");
  return writeIfChanged(fp, next);
}

function main() {
  console.log("== ago-1-core: MCP Phase 1 (Contract + Scaffolding) ==");

  const contract = `# MCP Tool Contract (Core / Nexus Plane)

## Purpose
MCP is the **standard tool interface plane** between:
- **Agents** (AGO-1 variants)
- **Orchestration** (Nexus / Core)
- **Governance** (Sentinel)
- **Tool Providers** (MCP Servers)

## Non-Negotiable Rule
Agents do not integrate directly with external systems.
All tool access flows via **Core/Nexus MCP Gateway → MCP Server**, governed by Sentinel.

## Envelope
ToolRequest: { tool, args, ctx { tenant, actor, purpose, classification, traceId } }
ToolResponse: { ok, data|error, meta { traceId, durationMs } }

## Policy
Default-deny. Phase 1 allows only shared.* tools.

`;
  const namespaces = `# MCP Tool Namespaces
- shared.* (cross-domain)
- chc.* (CHC Ops)
- ciag.* (CIAG)
- hospitality.* (Hospitality)
`;

  const changed = [];
  if (writeIfChanged(p("docs", "MCP_TOOL_CONTRACT.md"), contract)) changed.push("docs/MCP_TOOL_CONTRACT.md");
  if (writeIfChanged(p("docs", "MCP_TOOL_NAMESPACES.md"), namespaces)) changed.push("docs/MCP_TOOL_NAMESPACES.md");

  const envelopesTs = `export type Tenant = "chc" | "ciag" | "hospitality" | "shared";
export type Classification = "public" | "internal" | "confidential" | "restricted";

export type ToolRequest = {
  tool: string;
  args: Record<string, unknown>;
  ctx: {
    tenant: Tenant;
    actor: string;
    purpose: string;
    classification: Classification;
    traceId: string;
  };
};

export type ToolError = { code: string; message: string; details?: unknown };

export type ToolResponse<T = unknown> =
  | { ok: true; data: T; meta: { traceId: string; durationMs: number } }
  | { ok: false; error: ToolError; meta: { traceId: string; durationMs: number } };
`;

  const policyTs = `import type { ToolRequest } from "./envelopes";

/** Sentinel-facing policy hook (Phase 1): allow only shared.* */
export function evaluateToolPolicy(req: ToolRequest): { allowed: boolean; reason?: string } {
  if (req.tool.startsWith("shared.")) return { allowed: true };
  return { allowed: false, reason: "Tool not allowlisted (default-deny)." };
}
`;

  const gatewayTs = `import type { ToolRequest, ToolResponse } from "./envelopes";
import { evaluateToolPolicy } from "./policy";

export type ToolTransport = (req: ToolRequest) => Promise<ToolResponse>;

export async function callTool(transport: ToolTransport, req: ToolRequest): Promise<ToolResponse> {
  const t0 = Date.now();
  const policy = evaluateToolPolicy(req);
  if (!policy.allowed) {
    return {
      ok: false,
      error: { code: "POLICY_DENY", message: policy.reason ?? "Denied." },
      meta: { traceId: req.ctx.traceId, durationMs: Date.now() - t0 }
    };
  }
  const res = await transport(req);
  const durationMs = Date.now() - t0;
  return { ...(res as any), meta: { ...(res as any).meta, traceId: req.ctx.traceId, durationMs } } as ToolResponse;
}
`;

  const indexTs = `export * from "./envelopes";
export * from "./gateway";
export * from "./policy";
`;

  if (writeIfChanged(p("src", "mcp", "envelopes.ts"), envelopesTs)) changed.push("src/mcp/envelopes.ts");
  if (writeIfChanged(p("src", "mcp", "policy.ts"), policyTs)) changed.push("src/mcp/policy.ts");
  if (writeIfChanged(p("src", "mcp", "gateway.ts"), gatewayTs)) changed.push("src/mcp/gateway.ts");
  if (writeIfChanged(p("src", "mcp", "index.ts"), indexTs)) changed.push("src/mcp/index.ts");

  const rootIndex = p("src", "index.ts");
  if (exists(rootIndex)) ensureLineInFile(rootIndex, `export * as mcp from "./mcp";`);

  console.log("Changed files:", changed.length ? changed : "(no changes; already applied)");
  console.log("== Running build (required) ==");
  run("npm run build");
  console.log("== Patch complete ==");
}

main();
