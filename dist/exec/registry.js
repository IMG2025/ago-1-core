const REGISTRY = new Map();
export function registerExecutor(executor) {
    const id = executor.domain_id.trim();
    if (id.length === 0)
        throw new Error("EXECUTOR_DOMAIN_ID_REQUIRED");
    if (REGISTRY.has(id))
        throw new Error(`EXECUTOR_ALREADY_REGISTERED:${id}`);
    REGISTRY.set(id, executor);
}
export function getExecutor(domain_id) {
    return REGISTRY.get(domain_id.trim());
}
export function listExecutors() {
    return Array.from(REGISTRY.keys()).sort();
}
