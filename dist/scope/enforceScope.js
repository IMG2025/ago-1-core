function decision(allowed, reason, missing) {
    return missing && missing.length > 0
        ? { allowed, reason, missing }
        : { allowed, reason };
}
function requiredCapsForTaskType(task_type) {
    switch (task_type) {
        case "EXECUTE":
            return ["task:execute"];
        case "ANALYZE":
            return ["task:analyze"];
        case "ESCALATE":
            return ["task:escalate"];
        default: {
            // Exhaustiveness guard
            const _never = task_type;
            return _never;
        }
    }
}
/**
 * Scope enforcement (v1):
 * - Deny-by-default
 * - Task must include required capability for its task_type
 * - Ignores unknown capabilities (they do not grant permissions)
 */
export function enforceScope(task_type, scope) {
    if (!Array.isArray(scope) || scope.length === 0) {
        return decision(false, "SCOPE_MISSING", requiredCapsForTaskType(task_type));
    }
    const normalized = new Set(scope
        .filter((s) => typeof s === "string")
        .map((s) => s.trim())
        .filter((s) => s.length > 0));
    const required = requiredCapsForTaskType(task_type);
    const missing = required.filter((cap) => !normalized.has(cap));
    if (missing.length > 0) {
        return decision(false, "SCOPE_INSUFFICIENT", missing);
    }
    return decision(true, "SCOPE_OK");
}
