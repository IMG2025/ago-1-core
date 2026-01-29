#!/usr/bin/env bash
set -euo pipefail

write_if_changed() {
  local path="$1"
  local tmp
  tmp="$(mktemp)"
  cat > "$tmp"
  if [[ -f "$path" ]] && cmp -s "$tmp" "$path"; then
    rm -f "$tmp"
    echo "UNCHANGED: $path"
    return
  fi
  mv "$tmp" "$path"
  echo "WROTE: $path"
}

write_if_changed tsconfig.json <<'JSON'
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ES2022",
    "moduleResolution": "Bundler",
    "outDir": "dist",
    "rootDir": "src",
    "declaration": true,
    "emitDeclarationOnly": false,
    "strict": true,
    "exactOptionalPropertyTypes": true
  },
  "include": ["src"]
}
JSON

npm run build
