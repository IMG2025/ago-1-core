/**
 * MCP Tools Registry client (Phase 12)
 * - HTTP discovery via GET /tools
 * - Contract assertion helpers for enterprise-grade stability
 *
 * Note: This is intentionally transport-agnostic in shape, but implemented over HTTP
 * because /tools is a discovery endpoint (not a tool call).
 */
function withNoTrailingSlash(u) {
    return u.endsWith("/") ? u.slice(0, -1) : u;
}
export function getToolNames(registry) {
    return (registry?.tools || []).map(t => t.name).filter(Boolean).sort();
}
export function assertToolsRegistryContract(registry) {
    if (!registry || typeof registry !== "object")
        throw new Error("Invalid tools registry: not an object");
    if (registry.ok !== true)
        throw new Error("Invalid tools registry: ok !== true");
    // Schema is authoritative in Phase 11+, but we keep a soft gate for forward compatibility.
    if (registry.schema && registry.schema !== "mcp.tools-registry.v1") {
        throw new Error("Unsupported tools registry schema: " + registry.schema);
    }
    if (!Array.isArray(registry.tools))
        throw new Error("Invalid tools registry: tools must be an array");
    // If server provides ctx requirements, enforce shape.
    if (registry.requiredCtxFields && !Array.isArray(registry.requiredCtxFields)) {
        throw new Error("Invalid tools registry: requiredCtxFields must be an array");
    }
    // Tool objects must minimally carry name.
    for (const t of registry.tools) {
        if (!t || typeof t !== "object" || typeof t.name !== "string" || !t.name.trim()) {
            throw new Error("Invalid tools registry: tool missing name");
        }
    }
}
export async function listToolsHttp(opts) {
    if (!opts?.baseUrl || typeof opts.baseUrl !== "string") {
        throw new Error("listToolsHttp: baseUrl (string) is required");
    }
    const baseUrl = withNoTrailingSlash(opts.baseUrl);
    const url = baseUrl + "/tools";
    const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
    const timeoutMs = typeof opts.timeoutMs === "number" ? opts.timeoutMs : 8000;
    let t = null;
    if (controller) {
        t = setTimeout(() => controller.abort(), timeoutMs);
    }
    try {
        const init = controller
            ? { signal: controller.signal }
            : {};
        const res = await fetch(url, init);
        const text = await res.text();
        let json = null;
        try {
            json = JSON.parse(text);
        }
        catch { /* keep null */ }
        if (!res.ok) {
            const msg = json?.error?.message || json?.error?.code || text || ("HTTP " + res.status);
            throw new Error("listToolsHttp failed: " + msg);
        }
        if (!json || typeof json !== "object")
            throw new Error("listToolsHttp: invalid JSON response");
        return json;
    }
    finally {
        if (t)
            clearTimeout(t);
    }
}
