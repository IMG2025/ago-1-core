import type { SentinelAuthDecision, SentinelAuthRequest } from "./types.js";

function decision(
  allowed: boolean,
  reason: string,
  policy_id?: string
): SentinelAuthDecision {
  return policy_id
    ? { allowed, reason, policy_id }
    : { allowed, reason };
}

/**
 * Sentinel authorization stub (v0):
 * - No crypto
 * - No network
 * - Deterministic
 * - Deny-by-default
 */
export function authorize(req: SentinelAuthRequest): SentinelAuthDecision {
  const token = (req.authority_token ?? "").trim();
  if (token.length === 0) {
    return decision(false, "MISSING_TOKEN");
  }

  const m = /^SENTINEL:([A-Za-z0-9_.-]{3,64}):(.{10,})$/.exec(token);
  if (!m) {
    return decision(false, "TOKEN_FORMAT_INVALID");
  }

  const policy_id = m[1];

  if (req.sentinel_policy_id && req.sentinel_policy_id !== policy_id) {
    return decision(false, "POLICY_ID_MISMATCH", policy_id);
  }

  return decision(true, "ALLOW_FORMAT_OK", policy_id);
}
