# Skill: Enrich UI Tools (Custom Agent)

Add MCP Apps UI enrichment to an existing custom Agent service — detect UI tools after each tool call and push `render_ui_resource` messages to the frontend so MF components can be rendered in an iframe.

**When to use this skill**: When you need to add UI enrichment to a custom agent, integrate MCP Apps UI into a self-hosted agent, handle render_ui_resource in a custom agent, detect UI tools in on_tool_end, connect MCP Apps iframe rendering to an existing agent backend, or implement uiEnrichment for a custom agent framework.

> This skill only covers **server-side UI enrichment** (Step 4 in the custom agent integration guide). Prerequisites:
> - MCP Server running in HTTP mode (see `module-federation-mcp-starter`)
> - MCP Client already connected and tools registered to the LLM
> - Frontend already has a streaming channel (SSE / WebSocket)
>
> For full end-to-end setup, see `docs/zh/05-custom-agent-integration.md`.

---

## Overview

Standard MCP: tool returns → LLM continues generating text.

MCP Apps extends this: UI tools carry `_meta.ui.resourceUri` in their definition. Your agent needs to intercept these in `on_tool_end` (or equivalent), assemble an `iframeUrl`, and push a `render_ui_resource` message to the frontend instead of letting the raw result flow to the LLM.

**Core logic** (2 things only):
1. After each tool call: check `_meta.ui.resourceUri` → if present, assemble `iframeUrl` from `mcpServerBaseUrl`
2. Push `render_ui_resource` to frontend via your existing stream channel

---

## Workflow Checklist

- [ ] **Step 1**: Read existing agent code — find `on_tool_end` callback location ⚠️ REQUIRED
- [ ] **Step 2**: Read existing stream channel — find where messages are pushed to frontend ⚠️ REQUIRED
- [ ] **Step 3**: Insert `detectAndEnrichUiTool` utility
- [ ] **Step 4**: Wire into `on_tool_end`
- [ ] **Step 5**: Add `render_ui_resource` message type to stream channel
- [ ] **Step 6**: Ensure `_meta` is preserved in tool definitions

---

## Step 1: Read Existing Agent Code

Before writing anything, locate:

```bash
# Find the tool call / on_tool_end callback
grep -rn "on_tool_end\|tool_end\|callTool\|tool_call\|toolOutput\|ToolMessage" src/ --include="*.ts" --include="*.py" -l

# Find where SSE/WebSocket messages are pushed to frontend
grep -rn "res.write\|ws.send\|socket.emit\|yield\|stream" src/ --include="*.ts" --include="*.py" -l
```

**Ask yourself**:
- What framework? (LangGraph / LangChain / AutoGen / CrewAI / custom)
- What language? (TypeScript / Python)
- What streaming protocol? (SSE / WebSocket / gRPC / custom)
- Where does the `on_tool_end` callback fire? Is there a single event loop or distributed handlers?

---

## Step 2: Locate the `mcpTools` List

The tool definitions from `client.listTools()` (or equivalent) must be accessible where `on_tool_end` fires. Verify:

```bash
grep -rn "listTools\|tools/list\|mcpTools\|toolsDefinition" src/ --include="*.ts" --include="*.py"
```

If `mcpTools` is not passed to the callback, it needs to be captured at connection time and stored in scope. Example:

```typescript
const { tools: mcpTools } = await mcpClient.listTools();
// store mcpTools so it's accessible in on_tool_end
```

---

## Step 3: Add `detectAndEnrichUiTool` Utility

Create `src/uiEnrichment.ts` (TypeScript) or `agent/ui_enrichment.py` (Python):

### TypeScript

```typescript
// src/uiEnrichment.ts

export interface UiRenderPayload {
  /** URL of mcp-app-shell.html, used as iframe src */
  iframeUrl: string;
  /** Serialized CallToolResult text (MF component load config) */
  callToolResult: string;
  /** Tool arguments passed through to MF component as props */
  toolInput: Record<string, unknown>;
  /** Tool name */
  toolName: string;
}

/**
 * Call this after every tool invocation.
 * Returns a render payload if the tool is a UI tool; null otherwise.
 *
 * @param toolName        Name of the tool that just ran
 * @param toolInput       Arguments the tool was called with
 * @param callToolResultText  Serialized CallToolResult (the text content string)
 * @param mcpTools        Full tool list from tools/list
 * @param mcpServerBaseUrl  Public base URL of MCP Server, e.g. "http://localhost:3001/mcp-rpc"
 */
export function detectAndEnrichUiTool(
  toolName: string,
  toolInput: Record<string, unknown>,
  callToolResultText: string,
  mcpTools: any[],
  mcpServerBaseUrl: string,
): UiRenderPayload | null {
  const toolDef = mcpTools.find((t) => t.name === toolName);
  const resourceUri: string | undefined = (toolDef as any)?._meta?.ui?.resourceUri;

  if (!resourceUri) {
    return null; // regular tool, let normal text flow continue
  }

  // Use the lightweight shell page (~530 B, loads JS async from /static/)
  const iframeUrl = `${mcpServerBaseUrl.replace(/\/$/, '')}/static/mcp-app-shell.html`;

  return { iframeUrl, callToolResult: callToolResultText, toolInput, toolName };
}
```

### Python

```python
# agent/ui_enrichment.py
from dataclasses import dataclass
from typing import Any, Optional

@dataclass
class UiRenderPayload:
    iframe_url: str
    call_tool_result: str
    tool_input: dict
    tool_name: str

def detect_and_enrich_ui_tool(
    tool_name: str,
    tool_input: dict,
    call_tool_result_text: str,
    mcp_tools: list[Any],
    mcp_server_base_url: str,
) -> Optional[UiRenderPayload]:
    tool_def = next((t for t in mcp_tools if t.name == tool_name), None)
    resource_uri = (tool_def._meta or {}).get("ui", {}).get("resourceUri") if tool_def else None

    if not resource_uri:
        return None

    iframe_url = f"{mcp_server_base_url.rstrip('/')}/static/mcp-app-shell.html"
    return UiRenderPayload(
        iframe_url=iframe_url,
        call_tool_result=call_tool_result_text,
        tool_input=tool_input,
        tool_name=tool_name,
    )
```

---

## Step 4: Wire into `on_tool_end`

Insert the call in your existing tool-end callback. Match the pattern to your framework:

### LangGraph (TypeScript) — `streamEvents` loop

```typescript
// In your existing event loop:
for await (const event of agent.streamEvents(...)) {
  if (event.event === 'on_tool_end') {
    const toolName: string = event.name;
    const toolInput = event.data.input ?? {};

    // Normalize CallToolResult to string — LangGraph puts it in event.data.output
    const rawOutput = event.data.output;
    const callToolResultText =
      typeof rawOutput === 'string'
        ? rawOutput
        : typeof rawOutput?.content === 'string'
          ? rawOutput.content
          : JSON.stringify(rawOutput);

    // ← INSERT HERE
    const uiPayload = detectAndEnrichUiTool(
      toolName,
      toolInput,
      callToolResultText,
      mcpTools,
      'http://localhost:3001/mcp-rpc', // ← replace with your MCP Server URL
    );

    if (uiPayload) {
      yield { type: 'render_ui', payload: uiPayload };
      // continue — LLM may still generate follow-up text after the tool call
    }
  }
  // ... rest of existing event handling ...
}
```

### LangChain Python — `astream_events`

```python
async def stream_chat(user_input: str, agent, mcp_tools: list):
    async for event in agent.astream_events({"messages": [HumanMessage(user_input)]}, version="v2"):
        if event["event"] == "on_tool_end":
            tool_name = event["name"]
            tool_input = event["data"].get("input", {})
            raw_output = event["data"].get("output", "")
            call_tool_result_text = (
                raw_output if isinstance(raw_output, str)
                else raw_output.get("content", "") if isinstance(raw_output, dict)
                else str(raw_output)
            )

            # ← INSERT HERE
            ui_payload = detect_and_enrich_ui_tool(
                tool_name, tool_input, call_tool_result_text,
                mcp_tools, "http://localhost:3001/mcp-rpc",
            )
            if ui_payload:
                yield {"type": "render_ui", "payload": ui_payload}

        elif event["event"] == "on_chat_model_stream":
            text = event["data"]["chunk"].content or ""
            if text:
                yield {"type": "text", "payload": text}
```

### Custom framework

Find the point **immediately after** a tool returns its result and **before** the result is passed back to the LLM. Insert:

```typescript
// pseudo-code — adapt to your framework's callback signature
onToolComplete(toolName, toolInput, toolOutput) {
  const uiPayload = detectAndEnrichUiTool(toolName, toolInput, serialize(toolOutput), mcpTools, mcpServerBaseUrl);
  if (uiPayload) pushToFrontend({ type: 'render_ui_resource', ...uiPayload });
}
```

---

## Step 5: Add `render_ui_resource` to Your Stream Channel

Read your existing SSE/WebSocket send code and add one branch for `render_ui`:

### SSE (Node.js — Express / Koa / Hono)

```typescript
for await (const chunk of streamChat(message, agent, mcpTools)) {
  if (chunk.type === 'text') {
    // existing branch — keep as-is
    res.write(`data: ${JSON.stringify({ type: 'text', text: chunk.payload })}\n\n`);
  } else if (chunk.type === 'render_ui') {
    // ← ADD THIS BRANCH
    res.write(`data: ${JSON.stringify({
      type: 'render_ui_resource',
      iframeUrl:      chunk.payload.iframeUrl,
      callToolResult: chunk.payload.callToolResult,
      toolInput:      chunk.payload.toolInput,
      toolName:       chunk.payload.toolName,
      messageId:      crypto.randomUUID(), // frontend uses this as React key
    })}\n\n`);
  }
}
```

### SSE (Python — FastAPI)

```python
async def event_generator():
    async for chunk in stream_chat(message, agent, mcp_tools):
        if chunk["type"] == "text":
            yield f"data: {json.dumps({'type': 'text', 'text': chunk['payload']})}\n\n"
        elif chunk["type"] == "render_ui":
            p = chunk["payload"]
            yield f"data: {json.dumps({
                'type': 'render_ui_resource',
                'iframeUrl': p.iframe_url,
                'callToolResult': p.call_tool_result,
                'toolInput': p.tool_input,
                'toolName': p.tool_name,
                'messageId': str(uuid.uuid4()),
            })}\n\n"
```

### WebSocket

```typescript
// Same payload shape, just use ws.send instead of res.write
ws.send(JSON.stringify({
  type: 'render_ui_resource',
  iframeUrl:      uiPayload.iframeUrl,
  callToolResult: uiPayload.callToolResult,
  toolInput:      uiPayload.toolInput,
  toolName:       uiPayload.toolName,
  messageId:      crypto.randomUUID(),
}));
```

---

## Step 6: Ensure `_meta` is Preserved in Tool Definitions

`detectAndEnrichUiTool` reads `toolDef._meta.ui.resourceUri`. This field is part of the MCP tool definition returned by `tools/list`. Many Agent framework adapters silently drop unknown fields when converting to their internal tool format.

**Check your adapter**:

```typescript
// After calling client.listTools(), log one tool to verify _meta is present:
console.log(JSON.stringify(mcpTools[0], null, 2));
// Look for: "_meta": { "ui": { "resourceUri": "..." } }
```

If `_meta` is missing:

```typescript
// When building LangChain DynamicStructuredTool, explicitly preserve _meta:
const langchainTools = tools.map((tool) => new DynamicStructuredTool({
  name: tool.name,
  description: tool.description ?? '',
  schema: jsonSchemaToZod(tool.inputSchema ?? {}),
  func: async (args) => JSON.stringify(await client.callTool({ name: tool.name, arguments: args })),
  // Keep the original MCP tool definition in metadata for UI enrichment
  metadata: { _meta: (tool as any)._meta },
}));
```

If your adapter stores tools differently, ensure you retain the original `mcpTools` array from `listTools()` separately and pass it to `detectAndEnrichUiTool` — it doesn't need to be the same object the LLM sees.

---

## Verification

After wiring everything up:

```bash
# 1. Start MCP Server
cd module-federation-mcp-starter && pnpm run start

# 2. Verify a UI tool is listed and has _meta
curl http://localhost:3001/mcp-rpc/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}' \
  | jq '.result.tools[] | {name, _meta}'
# Expected: "_meta": { "ui": { "resourceUri": "ui://mf/..." } }

# 3. Trigger a tool call via your agent API and check the stream
curl -N http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "trigger the ui tool"}'
# Expected: a data: line with type: "render_ui_resource" containing iframeUrl and callToolResult
```

---

## Common Issues

**`_meta` is undefined in `detectAndEnrichUiTool`**
- The MCP SDK adapter stripped unknown fields. Keep the raw `mcpTools` array from `listTools()` separate and pass it to `detectAndEnrichUiTool`.

**`iframeUrl` is a `localhost` the browser can't reach**
- Set `mcpServerBaseUrl` to a publicly accessible URL (e.g. `https://mcp.example.com`). The browser fetches the iframe HTML directly — it cannot reach a server-side `localhost`.
- In development, if frontend and backend share the same machine, `http://localhost:3001/mcp-rpc` works.

**`render_ui_resource` message is missing `callToolResult`**
- Normalise `event.data.output` to a string before passing to `detectAndEnrichUiTool`. Different frameworks serialize `CallToolResult` differently (plain string, `{content: string}`, `{content: [{type:'text', text:...}]}`)

**UI tool appears but component doesn't render**
- See `docs/zh/05-custom-agent-integration.md` Step 6 for frontend `McpAppRenderer` / AppBridge setup.

---

## Next Steps

- **Frontend rendering**: See `docs/zh/05-custom-agent-integration.md` Step 6 — use `McpAppRenderer` (React) or manually wire `AppBridge` (plain JS)
- **Multi-step wizards**: See Step 7 of the same doc for handling `bridge.onmessage` / `sendMessage` callbacks
- **Multiple MCP Servers**: Track which `mcpServerBaseUrl` each tool belongs to; route `detectAndEnrichUiTool` accordingly
