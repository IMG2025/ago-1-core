#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

/**
 * Enforce Node ESM correctness by appending `.js` to relative export specifiers
 * inside src/mcp TS files.
 *
 * Idempotent: safe to run multiple times.
 * Ends with: npm run build
 */

const ROOT = path.resolve("src/mcp");

function rewriteFile(file) {
  const src = fs.readFileSync(file, "utf8");

  // Patch:
  //   export * from "./x"
  //   export { a } from "./x"
  // Only for relative paths starting with ./ or ../ and without an extension already.
  const next = src.replace(
    /(export\s+(?:\*\s+from|\{[^}]*\}\s+from)\s+["'])(\.{1,2}\/[^"']+?)(["'];?)/g,
    (m, p1, spec, p3) => {
      if (spec.endsWith(".js") || spec.endsWith(".json") || spec.endsWith(".node")) return m;
      return `${p1}${spec}.js${p3}`;
    }
  );

  if (next !== src) {
    fs.writeFileSync(file, next);
    console.log("Fixed:", file);
  }
}

function walk(dir) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(p);
    else if (ent.isFile() && p.endsWith(".ts")) rewriteFile(p);
  }
}

if (!fs.existsSync(ROOT)) {
  console.error("src/mcp not found:", ROOT);
  process.exit(1);
}

walk(ROOT);

console.log("== Running build (required) ==");
execSync("npm run build", { stdio: "inherit" });
