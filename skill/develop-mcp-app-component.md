# Develop an MCP App Component

Use this skill whenever the user wants to **build or modify a Module Federation component that is wired into the MCP Apps system** — including reading how to use the `mcpApp` prop, sending messages back to the agent, calling other tools from within the component, or designing a multi-step wizard flow.

---

## Step 0 — Locate the component

If the user describes an existing component, find it with:

```bash
find . -name "*.tsx" | xargs grep -l "mcpApp" 2>/dev/null
```

If no component exists yet, identify the `exposes` entry in `module-federation.config.ts` / `vmok.config.ts` and create the `.tsx` file at the referenced path.

---

## Step 1 — Understand the `mcpApp` prop interface

The MCP host **injects** `mcpApp` as a prop at render time. Components never import it. The full interface is:

```typescript
interface McpApp {
  /** Call another MCP tool directly from this component */
  callServerTool: (params: {
    name: string;
    arguments?: Record<string, unknown>;
  }) => Promise<{
    content: Array<{ type: string; text?: string }>;
    isError?: boolean;
  }>;

  /** Send a message into the agent conversation (triggers the next agent turn) */
  sendMessage?: (params: {
    role: string;
    content: Array<{ type: string; text: string }>;
  }) => Promise<{ isError?: boolean }>;
}

interface YourComponentProps {
  // ... your tool's inputSchema fields ...
  /** Injected by the MCP host — never pass this manually */
  mcpApp?: McpApp;
}
```

Key rules:
- `mcpApp` is **optional** — always use optional chaining (`mcpApp?.sendMessage`).
- `sendMessage` itself is optional on the interface — the host may not support it.
- Never import `McpApp` from an external package — declare the interface inline or locally.

---

## Step 2 — Choose: `callServerTool` or `sendMessage`

| Goal | Method |
|---|---|
| Call another MCP tool and use the result inside this component | `callServerTool` |
| Let the user confirm an action, then continue the agent conversation | `sendMessage` |
| Trigger the next step in a multi-step wizard | `sendMessage` |

### `callServerTool` — fetch data or run an action inside the component

```typescript
const handleCheck = async () => {
  const result = await mcpApp.callServerTool({
    name: 'get_deployment_status',
    arguments: { appId },
  });

  if (result.isError) {
    setError(result.content[0]?.text ?? 'Unknown error');
    return;
  }

  const data = JSON.parse(result.content[0]?.text ?? '{}');
  setStatus(data);
};
```

### `sendMessage` — inject a user message into the agent conversation

`sendMessage` must receive `content` as an **array of `{type, text}` objects**, never a bare string.

```typescript
const handleConfirm = async () => {
  if (!mcpApp?.sendMessage) return;

  const result = await mcpApp.sendMessage({
    role: 'user',
    content: [{ type: 'text', text: `User confirmed deployment of ${appName} to ${env}` }],
  });

  if (result?.isError) {
    setError('Agent rejected the message');
  }
};
```

#### Dual-channel fallback (for iframe-based hosts)

Some hosts (e.g., AI PaaS) receive messages through `window.parent.postMessage` rather than `sendMessage`. Use both for widest compatibility:

```typescript
const handleConfirm = async () => {
  const msg = `User confirmed deployment of ${appName} to ${env}`;

  // Channel 1: iframe postMessage (AI PaaS, embedded hosts)
  if (window.parent !== window) {
    window.parent.postMessage(
      { type: 'mcp-ui-message', role: 'user', content: { type: 'hidden', text: msg } },
      '*',
    );
  }

  // Channel 2: MCP sendMessage (Claude Desktop, standard MCP hosts)
  if (mcpApp?.sendMessage) {
    await mcpApp.sendMessage({
      role: 'user',
      content: [{ type: 'text', text: msg }],
    });
  }
};
```

---

## Step 3 — Multi-step wizard pattern

A multi-step wizard is implemented as **separate MCP tools**, one per step. The component in Step N sends a message that instructs the agent to call Step N+1, passing along the accumulated data as arguments.

### How the chain works

```
Agent calls step1 → renders Step1 component
User fills form → component calls sendMessage("call step2(appId=..., appName=..., env=...)")
Agent reads message → calls step2 → renders Step2 component
User fills form → component calls sendMessage("call step3(...all data from step1 and step2...)")
Agent reads message → calls step3 → renders final component
```

### Step 1 component pattern

```typescript
const handleNext = async () => {
  const msgText =
    `[Wizard] Step 1 done → call my_wizard_step2(` +
    `appId="${appId}", appName="${appName}", env="${env}")`;

  if (window.parent !== window) {
    window.parent.postMessage(
      { type: 'mcp-ui-message', role: 'user', content: { type: 'hidden', text: msgText } },
      '*',
    );
  }
  if (mcpApp?.sendMessage) {
    await mcpApp.sendMessage({
      role: 'user',
      content: [{ type: 'text', text: msgText }],
    });
  }
};
```

### Step 2+ props — accumulate all previous data

Each downstream step's `inputSchema` (and matching props type) must include **all fields from all previous steps** so nothing is lost:

```typescript
export interface WizardStep2Props {
  // From Step 1
  appId?: string;
  appName?: string;
  env?: string;
  // Injected by MCP host
  mcpApp?: McpApp;
}
```

### `mcp_apps.json` descriptions — prevent direct invocation

Tell the agent not to call Step 2+ directly. The `description` field is what the agent reads:

```json
{
  "name": "my_wizard_step2",
  "description": "Step 2 of the wizard. Triggered automatically by my_wizard_step1 — do NOT call directly. Receives appId, appName, env from Step 1. Lets the user configure advanced options.",
  "inputSchema": {
    "type": "object",
    "properties": {
      "appId":    { "type": "string", "description": "From Step 1: application ID" },
      "appName":  { "type": "string", "description": "From Step 1: application name" },
      "env":      { "type": "string", "description": "From Step 1: deployment environment" }
    }
  }
}
```

---

## Step 4 — Safe rendering outside an MCP host

During local development the component renders directly in a browser with no MCP host. Guard all `mcpApp` calls:

```typescript
const MyComponent: React.FC<MyProps> = ({ value, mcpApp }) => {
  const handleSubmit = async () => {
    if (!mcpApp) {
      console.warn('[MyComponent] mcpApp not available — running in dev mode');
      return;
    }
    await mcpApp.sendMessage({ role: 'user', content: [{ type: 'text', text: 'Done' }] });
  };
  // ...
};
```

To verify the prop is arriving in staging, add a temporary log:

```typescript
useEffect(() => {
  console.log('[MyComponent] mcpApp prop:', mcpApp);
}, [mcpApp]);
```

If `mcpApp` is `undefined` in the real host, check:
1. The host's `ComponentRenderer` passes `mcpApp={app}` (see `src/components/component-renderer.tsx`).
2. The `mcp_apps.json` entry exists and the server was restarted after editing it.
3. The component's `inputSchema` is valid JSON Schema (the host skips rendering on schema errors).

---

## Step 5 — Minimal working component skeleton

```typescript
import React, { useState } from 'react';

interface McpApp {
  callServerTool: (params: { name: string; arguments?: Record<string, unknown> }) => Promise<{
    content: Array<{ type: string; text?: string }>;
    isError?: boolean;
  }>;
  sendMessage?: (params: {
    role: string;
    content: Array<{ type: string; text: string }>;
  }) => Promise<{ isError?: boolean }>;
}

interface MyToolProps {
  // Fields from inputSchema
  title?: string;
  // Injected by MCP host
  mcpApp?: McpApp;
}

const MyTool: React.FC<MyToolProps> = ({ title = 'Untitled', mcpApp }) => {
  const [done, setDone] = useState(false);

  const handleConfirm = async () => {
    const msg = `User confirmed: ${title}`;

    if (window.parent !== window) {
      window.parent.postMessage(
        { type: 'mcp-ui-message', role: 'user', content: { type: 'hidden', text: msg } },
        '*',
      );
    }
    if (mcpApp?.sendMessage) {
      await mcpApp.sendMessage({ role: 'user', content: [{ type: 'text', text: msg }] });
    }
    setDone(true);
  };

  if (done) return <div>✅ Done</div>;

  return (
    <div>
      <h2>{title}</h2>
      <button onClick={handleConfirm}>Confirm</button>
    </div>
  );
};

export default MyTool;
```

---

## Step 6 — Register the component in `mcp_apps.json`

After writing the component, update `mcp_apps.json` so it appears as an MCP tool:

```json
{
  "mcpApps": [
    {
      "name": "my_tool",
      "description": "Shows {what it does} and lets the user {primary action}.",
      "baseUrl": "https://your-host/mf-manifest.json",
      "scope": "your_mf_scope",
      "module": "./MyTool",
      "inputSchema": {
        "type": "object",
        "properties": {
          "title": { "type": "string", "description": "Title to display" }
        }
      }
    }
  ]
}
```

After saving, restart the MCP server for the change to take effect.
