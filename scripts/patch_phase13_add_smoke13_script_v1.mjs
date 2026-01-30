#!/usr/bin/env node
/**
 * patch_phase13_add_smoke13_script_v1.mjs
 * Phase 13:
 * - Add mcp smoke that validates /health, /tools, and tool execution (read/readById/search)
 * - Add npm script mcp:smoke13
 *
 * Idempotent. Ends with: npm run build
 */
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

function run(cmd) { execSync(cmd, { stdio: "inherit" }); }
function read(p) { return fs.readFileSync(p, "utf8"); }
function writeIfChanged(p, next) {
  const prev = fs.existsSync(p) ? read(p) : "";
  if (prev !== next) {
    fs.writeFileSync(p, next);
    console.log("Patched:", p);
    return true;
  }
  console.log("No changes needed:", p);
  return false;
}
function ensureDir(p) { fs.mkdirSync(p, { recursive: true }); }

const ROOT = execSync("git rev-parse --show-toplevel", { encoding: "utf8" }).trim();

const smokePath = path.join(ROOT, "scripts", "mcp_smoke_phase13.mjs");
const patchDir = path.join(ROOT, "scripts");
ensureDir(patchDir);

const smokeSrc = `#!/usr/bin/env node
/**
 * mcp_smoke_phase13.mjs
 * Phase 13 smoke:
 * - Verifies shared server /health and /tools
 * - Executes shared.artifact_registry.read / readById / search successfully
 *
 * Base URL: MCP_SHARED_BASE (default http://127.0.0.1:8787)
 */
import { createHttpToolTransport, callTool } from "../dist/mcp/index.js";

const BASE = process.env.MCP_SHARED_BASE || "http://127.0.0.1:8787";

function assert(cond, msg) {
  if (!cond) throw new Error("ASSERT_FAIL: " + msg);
}

async function getJson(url) {
  const res = await fetch(url);
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { throw new Error("NON_JSON: " + url + " => " + text.slice(0, 200)); }
  return { res, json };
}

async function main() {
  // 1) health
  const h = await getJson(\`\${BASE}/health\`);
  assert(h.res.ok, "health http not ok");
  assert(h.json && h.json.ok === true, "health ok !== true");

  // 2) tools
  const t = await getJson(\`\${BASE}/tools\`);
  assert(t.res.ok, "tools http not ok");
  assert(t.json && t.json.ok === true, "tools ok !== true");
  assert(Array.isArray(t.json.tools), "tools.tools not array");

  const toolNames = t.json.tools.map(x => x?.name).filter(Boolean).sort();
  const required = [
    "shared.artifact_registry.read",
    "shared.artifact_registry.readById",
    "shared.artifact_registry.search"
  ].sort();

  for (const r of required) {
    assert(toolNames.includes(r), "missing tool in /tools: " + r);
  }

  // 3) execute tools
  const transport = createHttpToolTransport({ baseUrl: BASE });

  const ctx = {
    tenant: "shared",
    actor: "ago-1-core-smoke13",
    purpose: "phase13",
    classification: "internal",
    traceId: "core-phase13"
  };

  const r1 = await callTool(transport, { tool: "shared.artifact_registry.read", args: {}, ctx });
  assert(r1 && r1.ok === true, "read ok !== true");
  assert(r1.data && Array.isArray(r1.data.artifacts), "read data.artifacts not array");

  const r2 = await callTool(transport, { tool: "shared.artifact_registry.readById", args: { id: "ECF-1" }, ctx });
  assert(r2 && r2.ok === true, "readById ok !== true");
  assert(r2.data && r2.data.id === "ECF-1", "readById returned wrong id");
  // artifact can be null if not present, but schema must be present
  assert(typeof r2.data.schema === "string", "readById missing schema");

  const r3 = await callTool(transport, { tool: "shared.artifact_registry.search", args: { q: "AGO-1" }, ctx });
  assert(r3 && r3.ok === true, "search ok !== true");
  assert(r3.data && typeof r3.data.count === "number", "search missing count");
  assert(Array.isArray(r3.data.artifacts), "search artifacts not array");

  console.log(JSON.stringify({
    ok: true,
    phase: 13,
    base: BASE,
    tools: required,
    observed: {
      toolsCount: toolNames.length,
      readCount: r1.data.artifacts.length,
      searchCount: r3.data.count
    }
  }, null, 2));
}

main().catch((e) => {
  console.error(String(e && e.stack ? e.stack : e));
  process.exit(1);
});
`;

let changed = false;
changed = writeIfChanged(smokePath, smokeSrc) || changed;

// Ensure executable bit (best-effort; idempotent)
try {
  const st = fs.statSync(smokePath);
  const mode = st.mode & 0o777;
  if (mode !== 0o755) {
    fs.chmodSync(smokePath, 0o755);
    console.log("chmod 755:", smokePath);
    changed = true;
  }
} catch {}

const pkgPath = path.join(ROOT, "package.json");
if (!fs.existsSync(pkgPath)) {
  console.error("Missing package.json at repo root:", pkgPath);
  process.exit(1);
}

const pkg = JSON.parse(read(pkgPath));
pkg.scripts ||= {};
if (pkg.scripts["mcp:smoke13"] !== "node scripts/mcp_smoke_phase13.mjs") {
  pkg.scripts["mcp:smoke13"] = "node scripts/mcp_smoke_phase13.mjs";
  const nextPkg = JSON.stringify(pkg, null, 2) + "\n";
  changed = writeIfChanged(pkgPath, nextPkg) || changed;
}

if (!changed) console.log("No changes needed; already applied.");

console.log("== Running build (required) ==");
run("npm run build");
