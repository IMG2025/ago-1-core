#!/usr/bin/env node
/**
 * Fix TypeScript ESM emit for Node by enabling NodeNext resolution.
 * Ensures .js extensions are emitted in relative imports.
 */
import fs from "node:fs";

const path = "tsconfig.json";
const ts = JSON.parse(fs.readFileSync(path, "utf8"));

ts.compilerOptions ||= {};
ts.compilerOptions.module = "NodeNext";
ts.compilerOptions.moduleResolution = "NodeNext";
ts.compilerOptions.target ||= "ES2022";
ts.compilerOptions.outDir ||= "dist";

fs.writeFileSync(path, JSON.stringify(ts, null, 2) + "\n");
console.log("Updated tsconfig for Node ESM:", {
  module: ts.compilerOptions.module,
  moduleResolution: ts.compilerOptions.moduleResolution
});
