# 03 · Advanced Features

## 1. Fullscreen Mode (requestDisplayMode)

Components render in `inline` mode by default (embedded in the conversation flow). Switch to `fullscreen` for a larger canvas:

```tsx
import React, { useState } from 'react';

interface Props {
  mcpApp?: {
    requestDisplayMode?: (params: { mode: 'inline' | 'fullscreen' }) => Promise<{ mode: string }>;
  };
}

const FullscreenDemo: React.FC<Props> = ({ mcpApp }) => {
  const [mode, setMode] = useState<'inline' | 'fullscreen'>('inline');

  const toggle = async () => {
    if (!mcpApp?.requestDisplayMode) return;
    const newMode = mode === 'inline' ? 'fullscreen' : 'inline';
    const result = await mcpApp.requestDisplayMode({ mode: newMode });
    setMode(result.mode as 'inline' | 'fullscreen');
  };

  return (
    <div>
      <button onClick={toggle}>
        {mode === 'fullscreen' ? 'Exit fullscreen' : 'Go fullscreen'}
      </button>
      {/* your main content */}
    </div>
  );
};
```

> **Note**: `requestDisplayMode` is part of the MCP Apps protocol. Whether the request is honoured depends on the MCP Host (e.g. Claude Desktop). The host may ignore it.

---

## 2. Tool Visibility

`visibility` controls who can see and call a tool:

| Value | Meaning |
|-------|---------|
| `["model", "app"]` | **Default.** Claude Agent can call it; components can also call it via `callServerTool` |
| `["model"]` | Only Claude Agent can call it (not in the component's callable list) |
| `["app"]` | Only components can call it via `callServerTool` — **not visible in Claude's tool list** |

### Set visibility in mcp_apps.json

```json
{
  "tools": [
    {
      "name": "internal_helper",
      "title": "Internal Helper",
      "description": "Component-only helper — not exposed to Claude",
      "visibility": ["app"],
      "remote": "my_app",
      "module": "./InternalHelper"
    }
  ]
}
```

**Typical uses**:
- **UI tools** (`["model", "app"]`): Claude can proactively render them; components can also trigger them via `callServerTool`
- **Background data tools** (`["app"]`): Used only as component data sources — hidden from the Agent to prevent unwanted calls
- **Agent-only tools** (`["model"]`): Only the Agent can trigger them (components can still reach the same result indirectly via `sendMessage`)

---

## 3. proxyFetch: Using fetch_remote_resource from a Component

The built-in `fetch_remote_resource` tool is a CORS proxy that issues HTTP requests from the Node.js layer.

### Direct call

```tsx
const result = await mcpApp.callServerTool({
  name: 'fetch_remote_resource',
  arguments: {
    url: 'https://api.example.com/v1/users',
    method: 'GET',
    headers: {
      'Authorization': 'Bearer your-token',
      'Accept': 'application/json',
    },
  },
});

if (!result.isError) {
  // result.content[0].text is a JSON string with status / headers / body
  const response = JSON.parse(result.content[0].text!);
  console.log('Status:', response.status);
  const data = JSON.parse(response.body);
}
```

Response shape:

```typescript
{
  status: number;
  statusText: string;
  headers: Record<string, string>;
  body: string; // response body text (present for GET requests)
}
```

### Wrap it in a hook

```tsx
// hooks/useProxyFetch.ts
import { useCallback } from 'react';
import type { McpApp } from '../types/mcp';

export function useProxyFetch(mcpApp?: McpApp) {
  return useCallback(async <T = any>(
    url: string,
    options: { method?: 'GET' | 'HEAD'; headers?: Record<string, string> } = {}
  ): Promise<T> => {
    if (!mcpApp?.callServerTool) throw new Error('mcpApp not available');

    const result = await mcpApp.callServerTool({
      name: 'fetch_remote_resource',
      arguments: { url, method: options.method || 'GET', headers: options.headers },
    });

    if (result.isError) throw new Error(result.content[0]?.text || 'fetch failed');

    const response = JSON.parse(result.content[0].text!);
    if (response.status >= 400) throw new Error(`HTTP ${response.status}: ${response.statusText}`);

    return JSON.parse(response.body) as T;
  }, [mcpApp]);
}

// Usage
const MyComponent: React.FC<{ mcpApp?: McpApp }> = ({ mcpApp }) => {
  const proxyFetch = useProxyFetch(mcpApp);

  const loadData = async () => {
    const data = await proxyFetch<{ users: User[] }>('https://api.example.com/users');
    console.log(data.users);
  };

  return <button onClick={loadData}>Load</button>;
};
```

### Direct fetch vs. proxyFetch

| | Direct `fetch` | `fetch_remote_resource` via `callServerTool` |
|---|---|---|
| CORS restrictions | Subject to browser CORS | None (request goes through Node.js) |
| CSP requirement | Domain must be in `connectDomains` | No CSP config needed (uses MCP channel) |
| Best for | Your own CORS-enabled API | Third-party or internal APIs |
| Performance | Direct connection, low latency | One extra hop through MCP channel |

---

## 4. Custom MCP Server Tools

Beyond `fetch_remote_resource`, you can register your own business tools in `server.ts` for components to call via `callServerTool`:

```typescript
// In server.ts
server.registerTool(
  'get_user_info',
  {
    title: 'Get User Info',
    description: 'Get user information by ID',
    inputSchema: {
      userId: z.string().describe('User ID'),
    },
  },
  async ({ userId }) => {
    // Runs in Node.js — can access databases, file system, etc.
    const user = await db.users.findById(userId);
    return {
      content: [{ type: 'text', text: JSON.stringify(user) }],
    };
  }
);
```

Then call it from a component:

```tsx
const user = await mcpApp.callServerTool({
  name: 'get_user_info',
  arguments: { userId: '123' },
});
```

> To make a custom tool callable only by components (hidden from Claude's tool list), set `visibility: ["app"]`.

---

## 5. Multi-step Wizard Best Practices

Wizards are the most complex and most powerful pattern. Key points:

### 1. Write explicit Agent instructions

```typescript
// ✅ Good
const msg = [
  'User completed Step 1. **Immediately** call tool `deploy_wizard_step2` — do not ask the user any questions.',
  '',
  'Pass these arguments exactly (do not modify):',
  '```json',
  JSON.stringify(step1Data, null, 2),
  '```',
].join('\n');

// ❌ Bad (Agent may not know what to do next)
const msg = `Step 1 done, data is ${JSON.stringify(step1Data)}`;
```

### 2. Guard tool descriptions against unintended calls

```json
{
  "name": "deploy_wizard_step2",
  "description": "Step 2 of the deploy wizard. Triggered automatically by deploy_wizard_step1. **Do not call proactively.**"
}
```

### 3. Handle the loading gap

There is a delay between the user clicking "Next" and Step 2 rendering — show a loading state:

```tsx
const [status, setStatus] = useState<'idle' | 'loading' | 'done'>('idle');

const handleNext = async () => {
  setStatus('loading');
  await mcpApp?.sendMessage({ ... });
  setStatus('done');
};

return (
  <>
    <button onClick={handleNext} disabled={status === 'loading'}>
      {status === 'loading' ? 'Navigating...' : 'Next'}
    </button>
    {status === 'done' && <p>✅ Agent notified, loading next step...</p>}
  </>
);
```

### 4. Data passing strategy

Data travels via `sendMessage` → Agent → tool `inputSchema`. Keep the structure flat and unambiguous so the Agent can extract and forward it correctly. Avoid deeply nested objects or ambiguous field names.

---

## 6. Error Handling Inside Components

```tsx
import { ErrorBoundary } from 'react-error-boundary';

function ErrorFallback({ error }: { error: Error }) {
  return (
    <div style={{ padding: 20, color: 'red' }}>
      <h3>Component failed to load</h3>
      <p>{error.message}</p>
    </div>
  );
}

// Wrap your component to prevent errors from bubbling up
const SafeWidget = () => (
  <ErrorBoundary FallbackComponent={ErrorFallback}>
    <MyWidget />
  </ErrorBoundary>
);
```

The MCP App host already has a top-level `ErrorBoundary`, but adding one inside your component gives users a better error message.
