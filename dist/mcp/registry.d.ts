/**
 * MCP Tools Registry client (Phase 12)
 * - HTTP discovery via GET /tools
 * - Contract assertion helpers for enterprise-grade stability
 *
 * Note: This is intentionally transport-agnostic in shape, but implemented over HTTP
 * because /tools is a discovery endpoint (not a tool call).
 */
export type ToolsRegistryToolMeta = {
    name: string;
    version?: string;
    description?: string;
    metaSchema?: string;
    argsSchema?: unknown;
    responseSchema?: unknown;
};
export type ToolsRegistry = {
    ok: boolean;
    schema?: string;
    requiredCtxFields?: string[];
    tenants?: string[];
    namespaceAllowlistByTenant?: Record<string, string[]>;
    tools: ToolsRegistryToolMeta[];
};
export type ListToolsHttpOptions = {
    baseUrl: string;
    timeoutMs?: number;
};
export declare function getToolNames(registry: ToolsRegistry): string[];
export declare function assertToolsRegistryContract(registry: ToolsRegistry): void;
export declare function listToolsHttp(opts: ListToolsHttpOptions): Promise<ToolsRegistry>;
