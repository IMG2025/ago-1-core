import type { ToolRequest, ToolResponse } from "./envelopes.js";
import { evaluateToolPolicy } from "./policy.js";

export type ToolTransport = (req: ToolRequest) => Promise<ToolResponse>;

export async function callTool(transport: ToolTransport, req: ToolRequest): Promise<ToolResponse> {
  const t0 = Date.now();
  const policy = evaluateToolPolicy(req);
  if (!policy.allowed) {
    return {
      ok: false,
      error: { code: "POLICY_DENY", message: policy.reason ?? "Denied." },
      meta: { traceId: req.ctx.traceId, durationMs: Date.now() - t0 }
    };
  }
  const res = await transport(req);
  const durationMs = Date.now() - t0;
  return { ...(res as any), meta: { ...(res as any).meta, traceId: req.ctx.traceId, durationMs } } as ToolResponse;
}
