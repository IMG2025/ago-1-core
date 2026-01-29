# MCP Tool Contract (ago-1-core / Nexus Plane)

## Purpose
Model Context Protocol (MCP) is the standard tool interface plane between:
- Agents (AGO-1 variants)
- Orchestration (Core/Nexus)
- Governance (Sentinel)
- Tool Providers (MCP Servers)

## Rule
Agents do not integrate directly with external systems.
All tool access flows via Core/Nexus MCP Gateway → MCP Server, governed by Sentinel.

## Envelope
ToolRequest: { tool, args, ctx { tenant, actor, purpose, classification, traceId } }
ToolResponse: { ok, data|error, meta { traceId, durationMs } }

## Policy
Default-deny. Phase 1 allows only shared.* tools.
