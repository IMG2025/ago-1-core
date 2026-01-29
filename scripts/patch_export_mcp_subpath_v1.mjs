#!/usr/bin/env node
/**
 * patch_export_mcp_subpath_v1.mjs
 * Idempotent patch:
 * - Adds "exports./mcp" for ESM consumers
 * - Preserves existing "." export shape (types/default)
 * - Ends with npm run build
 */
import fs from "node:fs";

const pkgPath = "package.json";
const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));

pkg.type ||= "module";
pkg.exports ||= {};

// Ensure root export stays intact
pkg.exports["."] ||= {
  types: pkg.types || "./dist/index.d.ts",
  default: pkg.main || "./dist/index.js",
};

// Add MCP subpath export (types + default)
pkg.exports["./mcp"] = {
  types: "./dist/mcp/index.d.ts",
  default: "./dist/mcp/index.js",
};

fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n");
console.log("exports now =", pkg.exports);

// Required build gate
import { execSync } from "node:child_process";
execSync("npm run build", { stdio: "inherit" });
