import type { ToolRequest, ToolResponse } from "./envelopes";
export type ToolTransport = (req: ToolRequest) => Promise<ToolResponse>;
export declare function callTool(transport: ToolTransport, req: ToolRequest): Promise<ToolResponse>;
