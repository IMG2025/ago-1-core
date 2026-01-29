#!/usr/bin/env node
/**
 * Make ago-1-core MCP ESM-correct for Node16/NodeNext TS:
 * - Add `.js` to ALL relative imports/exports under src/mcp
 * - Fix directory specifiers to explicit index.js
 * - Fix root export in src/index.ts to export ./mcp/index.js
 *
 * Idempotent. Ends with npm run build.
 */
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

function read(p) { return fs.readFileSync(p, "utf8"); }
function write(p, s) { fs.writeFileSync(p, s); }

function rewriteSpecifiers(src) {
  // 1) Append .js to relative specifiers in import/export-from statements
  // Covers:
  //   import ... from "./x"
  //   export * from "./x"
  //   export { a } from "./x"
  let next = src.replace(
    /((?:import|export)\s+(?:type\s+)?(?:[\s\S]*?)\sfrom\s+["'])(\.{1,2}\/[^"']+?)(["'])/g,
    (m, p1, spec, p3) => {
      if (spec.endsWith(".js") || spec.endsWith(".json") || spec.endsWith(".node")) return m;
      return `${p1}${spec}.js${p3}`;
    }
  );

  // 2) Fix bare directory specifiers that should point to index.js
  // Specifically handle the common case we hit:
  //   export * from "./transports.js"  -> "./transports/index.js"
  next = next.replace(/(["'])(\.{1,2}\/transports)\.js(["'])/g, `$1$2/index.js$3`);

  return next;
}

function walkAndPatch(dir) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walkAndPatch(p);
    else if (ent.isFile() && p.endsWith(".ts")) {
      const src = read(p);
      const next = rewriteSpecifiers(src);
      if (next !== src) {
        write(p, next);
        console.log("Patched:", p);
      }
    }
  }
}

const MCP_ROOT = path.resolve("src/mcp");
if (!fs.existsSync(MCP_ROOT)) {
  console.error("Missing src/mcp:", MCP_ROOT);
  process.exit(1);
}

// Patch everything under src/mcp
walkAndPatch(MCP_ROOT);

// Patch src/index.ts export for mcp namespace
const indexPath = path.resolve("src/index.ts");
if (fs.existsSync(indexPath)) {
  const src = read(indexPath);
  let next = src;

  // Replace: export * as mcp from "./mcp";
  // With:    export * as mcp from "./mcp/index.js";
  next = next.replace(
    /export\s+\*\s+as\s+mcp\s+from\s+["']\.\/mcp["'];?/g,
    `export * as mcp from "./mcp/index.js";`
  );

  if (next !== src) {
    write(indexPath, next);
    console.log("Patched:", indexPath);
  }
}

console.log("== Running build (required) ==");
execSync("npm run build", { stdio: "inherit" });
