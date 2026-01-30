#!/usr/bin/env node
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
  const h = await getJson(`${BASE}/health`);
  assert(h.res.ok, "health http not ok");
  assert(h.json && h.json.ok === true, "health ok !== true");

  // 2) tools
  const t = await getJson(`${BASE}/tools`);
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
