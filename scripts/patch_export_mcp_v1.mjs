#!/usr/bin/env node
/**
 * Expose MCP as a public export from ago-1-core
 */
import fs from "fs";
import path from "path";

const pkgPath = path.resolve("package.json");
const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));

pkg.exports ||= {};
pkg.exports["."] ||= "./dist/index.js";
pkg.exports["./mcp"] = "./dist/mcp/index.js";

fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n");
console.log("Updated package.json exports:", pkg.exports);
