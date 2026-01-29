export type Tenant = "chc" | "ciag" | "hospitality" | "shared";
export type Classification = "public" | "internal" | "confidential" | "restricted";

export type ToolRequest = {
  tool: string;
  args: Record<string, unknown>;
  ctx: {
    tenant: Tenant;
    actor: string;
    purpose: string;
    classification: Classification;
    traceId: string;
  };
};

export type ToolError = { code: string; message: string; details?: unknown };

export type ToolResponse<T = unknown> =
  | { ok: true; data: T; meta: { traceId: string; durationMs: number } }
  | { ok: false; error: ToolError; meta: { traceId: string; durationMs: number } };
