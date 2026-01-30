#!/usr/bin/env node
/**
 * patch_phase12_fix_fetch_signal_types_v1.mjs
 *
 * Fix TypeScript exactOptionalPropertyTypes violation:
 * - Never pass `signal: undefined` to fetch()
 * - Conditionally construct RequestInit instead
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
const registryPath = path.join(ROOT, "src", "mcp", "registry.ts");

if (!fs.existsSync(registryPath)) {
  console.error("Missing:", registryPath);
  process.exit(1);
}

let src = read(registryPath);

// Replace the incorrect fetch invocation with a safe RequestInit build
src = src.replace(
  /const\s+res\s*=\s*await\s+fetch\(\s*url\s*,\s*\{\s*signal:\s*controller\s*\?\s*controller\.signal\s*:\s*undefined\s*\}\s*\)\s*;/m,
  `
    const init: RequestInit = controller
      ? { signal: controller.signal }
      : {};

    const res = await fetch(url, init);
  `.trim()
);

writeIfChanged(registryPath, src);

console.log("== Running build (required) ==");
run("npm run build");
