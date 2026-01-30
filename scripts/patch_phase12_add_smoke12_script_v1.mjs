#!/usr/bin/env node
/**
 * patch_phase12_add_smoke12_script_v1.mjs
 *
 * Adds:
 * - scripts/mcp_smoke_phase12.mjs
 * - package.json script: "mcp:smoke12"
 *
 * Idempotent. Ends with: npm run build
 */
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

function run(cmd) {
  execSync(cmd, { stdio: "inherit" });
}
function read(p) {
  return fs.readFileSync(p, "utf8");
}
function writeIfChanged(p, next) {
  const prev = fs.existsSync(p) ? read(p) : "";
  if (prev !== next) {
    fs.writeFileSync(p, next);
    console.log("Patched:", p);
    return true;
  }
  console.log("No changes needed; already applied:", p);
  return false;
}

const ROOT = execSync("git rev-parse --show-toplevel", { encoding: "utf8" }).trim();
const pkgPath = path.join(ROOT, "package.json");
const scriptsDir = path.join(ROOT, "scripts");
const smokePath = path.join(scriptsDir, "mcp_smoke_phase12.mjs");

if (!fs.existsSync(pkgPath)) {
  console.error("Missing:", pkgPath);
  process.exit(1);
}
if (!fs.existsSync(scriptsDir)) fs.mkdirSync(scriptsDir, { recursive: true });

// 1) Create smoke script (kept minimal; validates tools endpoint + expected tool names)
const smoke = `#!/usr/bin/env node
const BASE = process.env.MCP_SHARED_BASE || "http://127.0.0.1:8787";

function assert(cond, msg) {
  if (!cond) throw new Error("ASSERT_FAIL: " + msg);
}

async function main() {
  const r = await fetch(\`\${BASE}/tools\`);
  assert(r.ok, "GET /tools not ok => " + r.status);
  const j = await r.json();

  const tools = Array.isArray(j.tools) ? j.tools : [];
  const names = tools.map(t => (typeof t === "string" ? t : t?.name)).filter(Boolean);

  const expected = [
    "shared.artifact_registry.read",
    "shared.artifact_registry.readById",
    "shared.artifact_registry.search"
  ];

  for (const e of expected) {
    assert(names.includes(e), "missing tool => " + e);
  }

  console.log(JSON.stringify({
    ok: true,
    phase: 12,
    base: BASE,
    tools: expected
  }, null, 2));
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
`;

writeIfChanged(smokePath, smoke);
try { fs.chmodSync(smokePath, 0o755); } catch {}

// 2) Add npm script to package.json
const pkg = JSON.parse(read(pkgPath));
pkg.scripts ||= {};
if (pkg.scripts["mcp:smoke12"] !== "node scripts/mcp_smoke_phase12.mjs") {
  pkg.scripts["mcp:smoke12"] = "node scripts/mcp_smoke_phase12.mjs";
  writeIfChanged(pkgPath, JSON.stringify(pkg, null, 2) + "\n");
} else {
  console.log("No changes needed; already applied:", pkgPath);
}

console.log("== Running build (required) ==");
run("npm run build");
