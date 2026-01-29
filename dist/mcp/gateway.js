import { evaluateToolPolicy } from "./policy";
export async function callTool(transport, req) {
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
    return { ...res, meta: { ...res.meta, traceId: req.ctx.traceId, durationMs } };
}
