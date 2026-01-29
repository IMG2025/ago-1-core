#!/usr/bin/env bash
set -euo pipefail

mkdir -p domains/ciag domains/hospitality

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

write_if_changed domains/ciag/README.md <<'MD'
# AGO-1 Domain: CIAG

**Status:** Frozen  
**Origin:** ciag-ago-1  
**Purpose:** Advisory workflows and internal CIAG operations

This domain contains CIAG-specific task schemas, playbooks,
and deterministic scripts.

No runtime logic is permitted here.
MD

write_if_changed domains/hospitality/README.md <<'MD'
# AGO-1 Domain: Hospitality

**Status:** Active  
**Origin:** coreidentity-ago-1  
**Purpose:** Hospitality pilot (Cole Hospitality and related ops)

This domain contains hospitality-specific task schemas,
integrations, and runbooks.

No runtime logic is permitted here.
MD

npm run build
