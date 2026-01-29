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

function main() {
  console.log("== ago-1-core: MCP Phase 2 (HTTP transport) ==");

  const changed = [];

  const mcpIndexPath = p("src", "mcp", "index.ts");
  if (!exists(mcpIndexPath)) {
    console.error("ERROR: src/mcp/index.ts missing. Apply MCP Phase 1 first.");
    process.exit(1);
  }

  const httpTransportPath = p("src", "mcp", "transports", "httpTransport.ts");
  const transportIndexPath = p("src", "mcp", "transports", "index.ts");

  const httpTransport = `import type { ToolRequest, ToolResponse } from "../envelopes";

export type HttpTransportConfig = {
  baseUrl: string;
  timeoutMs?: number;
};

export function createHttpToolTransport(cfg: HttpTransportConfig) {
  const timeoutMs = cfg.timeoutMs ?? 10_000;

  return async function httpTransport(req: ToolRequest): Promise<ToolResponse> {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await fetch(\`\${cfg.baseUrl}/tool\`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(req),
        signal: controller.signal
      });

      const json = await res.json().catch(() => null);
      if (!json || typeof json !== "object") {
        return {
          ok: false,
          error: { code: "BAD_RESPONSE", message: "Non-JSON response from tool server." },
          meta: { traceId: req.ctx.traceId, durationMs: 0 }
        };
      }

      return json as ToolResponse;
    } catch (e: any) {
      const msg = e?.name === "AbortError" ? "Tool call timed out." : "Tool call failed.";
      return {
        ok: false,
        error: { code: "TRANSPORT_ERROR", message: msg, details: String(e?.message ?? e) },
        meta: { traceId: req.ctx.traceId, durationMs: 0 }
      };
    } finally {
      clearTimeout(t);
    }
  };
}
`;

  const transportIndex = `export * from "./httpTransport";
`;

  if (writeIfChanged(httpTransportPath, httpTransport)) changed.push("src/mcp/transports/httpTransport.ts");
  if (writeIfChanged(transportIndexPath, transportIndex)) changed.push("src/mcp/transports/index.ts");

  const mcpIndexPrev = read(mcpIndexPath);
  if (!mcpIndexPrev.includes(`export * from "./transports";`)) {
    const next = mcpIndexPrev.replace(/\s*$/, "") + `\nexport * from "./transports";\n`;
    if (writeIfChanged(mcpIndexPath, next)) changed.push("src/mcp/index.ts (export transports)");
  }

  console.log("Changed files:", changed.length ? changed : "(no changes; already applied)");
  console.log("== Running build (required) ==");
  run("npm run build");
  console.log("== Patch complete ==");
}

main();
