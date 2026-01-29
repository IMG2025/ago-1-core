import type { ToolRequest, ToolResponse } from "../envelopes.js";
export type HttpTransportConfig = {
    baseUrl: string;
    timeoutMs?: number;
};
export declare function createHttpToolTransport(cfg: HttpTransportConfig): (req: ToolRequest) => Promise<ToolResponse>;
