#!/usr/bin/env bash
set -euo pipefail

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

# Enable EXECUTE for hospitality domain (manifest-only)
write_if_changed domains/hospitality/domain.json <<'JSON'
{
  "domain_id": "hospitality",
  "owner": "CHC",
  "status": "ACTIVE",
  "supported_task_types": ["EXECUTE", "ANALYZE", "ESCALATE"],
  "required_scopes": {
    "EXECUTE": ["task:execute"],
    "ANALYZE": ["task:analyze"],
    "ESCALATE": ["task:escalate"]
  }
}
JSON

npm run build
