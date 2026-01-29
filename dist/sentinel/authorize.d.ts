import type { SentinelAuthDecision, SentinelAuthRequest } from "./types.js";
/**
 * Sentinel authorization stub (v0):
 * - No crypto
 * - No network
 * - Deterministic
 * - Deny-by-default
 */
export declare function authorize(req: SentinelAuthRequest): SentinelAuthDecision;
