#!/usr/bin/env node
/**
 * Finalize ago-1-core ESM exports
 * - Expose root
 * - Expose ./mcp
 */
import fs from "node:fs";
import path from "node:path";

const pkgPath = path.resolve("package.json");
const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));

pkg.type ||= "module";

pkg.exports = {
  ".": {
    "import": "./dist/index.js"
  },
  "./mcp": {
    "import": "./dist/mcp/index.js"
  }
};

fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n");
console.log("Updated exports:", pkg.exports);
