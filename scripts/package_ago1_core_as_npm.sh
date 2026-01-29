#!/usr/bin/env bash
set -euo pipefail

# Ensure we are in repo root (best-effort)
if [[ ! -f package.json ]]; then
  echo "ERROR: package.json not found. Run this from the ago-1-core repo root."
  exit 1
fi

# 1) Normalize package.json to be a consumable library package.
node - <<'NODE'
const fs = require("fs");

const p = "package.json";
const pkg = JSON.parse(fs.readFileSync(p, "utf8"));

// Set a stable package name (change if you have a naming convention)
pkg.name = pkg.name || "@chc/ago-1-core";

// Ensure version exists
pkg.version = pkg.version || "0.1.0";

// Library entrypoints
pkg.type = "module";
pkg.main = "./dist/index.js";
pkg.types = "./dist/index.d.ts";

// Node/TS-friendly exports map
pkg.exports = pkg.exports || {};
pkg.exports["."] = {
  types: "./dist/index.d.ts",
  default: "./dist/index.js"
};

// Only publish/pack what we want
pkg.files = Array.from(new Set([...(pkg.files || []), "dist"]));

// Make sure build exists
pkg.scripts = pkg.scripts || {};
pkg.scripts.build = pkg.scripts.build || "tsc -p tsconfig.json";

// Ensure pack always uses built output
pkg.scripts.prepack = "npm run build";

// Write back deterministically (2-space)
fs.writeFileSync(p, JSON.stringify(pkg, null, 2) + "\n");
console.log("UPDATED package.json for NPM packaging:", pkg.name, pkg.version);
NODE

# 2) Build (required)
npm run build

# 3) Create a local distributable tarball (idempotent enough; filename includes version)
#    We intentionally do this AFTER build so dist is packaged.
npm pack >/dev/null
echo "PACKED: $(ls -1 *.tgz | tail -n 1)"

# 4) End with npm run build (per rule)
npm run build
