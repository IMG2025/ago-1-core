import type { ToolRequest, ToolResponse } from "../envelopes";

export type HttpTransportConfig = {
  baseUrl: string;
  timeoutMs?: number;
};

export function createHttpToolTransport(cfg: HttpTransportConfig) {
  const timeoutMs = cfg.timeoutMs ?? 10_000;

  return async function httpTransport(req: ToolRequest): Promise<ToolResponse> {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await fetch(`${cfg.baseUrl}/tool`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(req),
        signal: controller.signal
      });

      const json = await res.json().catch(() => null);
      if (!json || typeof json !== "object") {
        return {
          ok: false,
          error: { code: "BAD_RESPONSE", message: "Non-JSON response from tool server." },
          meta: { traceId: req.ctx.traceId, durationMs: 0 }
        };
      }

      return json as ToolResponse;
    } catch (e: any) {
      const msg = e?.name === "AbortError" ? "Tool call timed out." : "Tool call failed.";
      return {
        ok: false,
        error: { code: "TRANSPORT_ERROR", message: msg, details: String(e?.message ?? e) },
        meta: { traceId: req.ctx.traceId, durationMs: 0 }
      };
    } finally {
      clearTimeout(t);
    }
  };
}
