#!/usr/bin/env node
const BASE = process.env.MCP_SHARED_BASE || "http://127.0.0.1:8787";

function assert(cond, msg) {
  if (!cond) throw new Error("ASSERT_FAIL: " + msg);
}

async function main() {
  const r = await fetch(`${BASE}/tools`);
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
