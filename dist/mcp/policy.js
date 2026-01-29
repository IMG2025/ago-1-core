/** Sentinel-facing policy hook (Phase 1): allow only shared.* */
export function evaluateToolPolicy(req) {
    if (req.tool.startsWith("shared."))
        return { allowed: true };
    return { allowed: false, reason: "Tool not allowlisted (default-deny)." };
}
