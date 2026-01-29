#!/usr/bin/env bash
set -euo pipefail

mkdir -p scripts src/task docs domains

write_if_changed() {
  local path="$1"
  local tmp
  tmp="$(mktemp)"
  cat > "$tmp"
  mkdir -p "$(dirname "$path")"
  if [[ -f "$path" ]] && cmp -s "$tmp" "$path"; then
    rm -f "$tmp"
    echo "UNCHANGED: $path"
  else
    mv "$tmp" "$path"
    echo "WROTE: $path"
  fi
}

write_if_changed package.json <<'JSON'
{
  "name": "ago-1-core",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "typecheck": "tsc -p tsconfig.json --noEmit"
  },
  "devDependencies": {
    "typescript": "^5.6.3"
  }
}
JSON

write_if_changed tsconfig.json <<'JSON'
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022"],
    "module": "ES2022",
    "moduleResolution": "Bundler",
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "esModuleInterop": true,
    "skipLibCheck": true
  },
  "include": ["src/**/*.ts"]
}
JSON

write_if_changed docs/AGO_1_CORE_README.md <<'MD'
# AGO-1 Core Runtime

**Owner:** CHC  
**Role:** Canonical execution runtime for all AGO-1 domains  
**Status:** Active

This repository contains the single authoritative AGO-1 runtime.
All domain-specific logic (CIAG, Hospitality, etc.) must plug in as
domain packs under `/domains`.

No domain may reimplement the runtime.
MD

write_if_changed src/task/types.ts <<'TS'
export type TaskType = "EXECUTE" | "ANALYZE" | "ESCALATE";

export type AgoTask = Readonly<{
  task_id: string;
  task_type: TaskType;
  requested_by: string;
  authority_token: string;
  scope: readonly string[];
  inputs: Record<string, unknown>;
  created_at: string;
}>;
TS

write_if_changed src/task/validateTask.ts <<'TS'
import type { AgoTask } from "./types.js";

export function validateTask(task: unknown): AgoTask {
  if (typeof task !== "object" || task === null) {
    throw new Error("Task must be an object");
  }
  const t = task as Record<string, unknown>;

  if (typeof t.task_id !== "string" || t.task_id.trim().length === 0) {
    throw new Error("task_id required");
  }

  const tt = String(t.task_type);
  if (!["EXECUTE", "ANALYZE", "ESCALATE"].includes(tt)) {
    throw new Error("invalid task_type");
  }

  return t as AgoTask;
}
TS

write_if_changed src/index.ts <<'TS'
export * from "./task/validateTask.js";
TS

if [[ ! -d .git ]]; then
  git init
fi

if [[ ! -d node_modules ]]; then
  npm install
fi

npm run build
