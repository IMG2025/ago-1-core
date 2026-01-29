import type { ToolRequest } from "./envelopes";
/** Sentinel-facing policy hook (Phase 1): allow only shared.* */
export declare function evaluateToolPolicy(req: ToolRequest): {
    allowed: boolean;
    reason?: string;
};
