# 02 · Component Guide

> How to handle rendering, prop injection, and two-way communication with the Agent inside your MF components.

## How Props Are Injected

When Claude calls a tool, this is what happens:

```
Claude calls tool(args)
  → MCP Server packages args into the resource config
  → MCP App (iframe) receives the config
  → Loads your MF component
  → Renders it with {...args, mcpApp} as props
```

Your component receives two kinds of props:

| Prop source | Description |
|-------------|-------------|
| Fields declared in `inputSchema` | Passed in by Claude when calling the tool — come from the user / Agent |
| `mcpApp` | **Auto-injected** by the MCP framework — no need to declare it in `inputSchema` |

---

## Full Props Type Definition

Copy this type into your project:

```typescript
// types/mcp.ts

export interface McpApp {
  /**
   * Call any tool registered on the MCP Server.
   * Works for your own tools and the built-in fetch_remote_resource.
   */
  callServerTool: (params: {
    name: string;
    arguments?: Record<string, unknown>;
  }) => Promise<{
    content: Array<{ type: string; text?: string }>;
    isError?: boolean;
  }>;

  /**
   * Send a user message to the Claude Agent.
   * The Agent treats this exactly like a message typed by the user,
   * and will respond (call tools, answer questions, etc.).
   */
  sendMessage?: (params: {
    role: 'user';
    content: Array<{ type: 'text'; text: string }>;
  }) => Promise<{ isError?: boolean }>;
}
```

---

## Pattern 1: Display-only component

Just receives props and renders UI — no Agent communication needed:

```tsx
interface AppListProps {
  appType?: string;
  env?: string;
  locale?: 'en' | 'zh';
  mcpApp?: McpApp; // declare but don't use — that's fine
}

const AppList: React.FC<AppListProps> = ({ appType = 'Web', env, locale = 'en' }) => {
  const [apps, setApps] = useState([]);

  useEffect(() => {
    // Direct fetch to your own API (the domain must be in csp.connectDomains)
    fetch(`/api/apps?type=${appType}&env=${env}`)
      .then(r => r.json())
      .then(setApps);
  }, [appType, env]);

  return (
    <ul>
      {apps.map(app => <li key={app.id}>{app.name}</li>)}
    </ul>
  );
};
```

---

## Pattern 2: Component sends a message to the Agent (sendMessage)

After the user completes an action, report the result to Claude so it can continue the workflow:

```tsx
const ConfirmForm: React.FC<{ mcpApp?: McpApp }> = ({ mcpApp }) => {
  const [value, setValue] = useState('');

  const handleSubmit = async () => {
    if (!mcpApp?.sendMessage) {
      alert('Not running inside an MCP context');
      return;
    }

    // The message appears in the conversation; the Agent will act on it
    await mcpApp.sendMessage({
      role: 'user',
      content: [{
        type: 'text',
        text: `User submitted the form with value: ${value}. Please continue to the next step.`,
      }],
    });
  };

  return (
    <div>
      <input value={value} onChange={e => setValue(e.target.value)} />
      <button onClick={handleSubmit}>Submit</button>
    </div>
  );
};
```

> **What `sendMessage` does**: it injects a message into Claude's conversation context, exactly as if the user had typed it. Claude responds accordingly (calls tools, answers questions, etc.).

---

## Pattern 3: Component calls an MCP Server tool (callServerTool)

The component can directly call any tool registered on the MCP Server, routing requests through Node.js to bypass CORS:

```tsx
const DataPanel: React.FC<{ mcpApp?: McpApp }> = ({ mcpApp }) => {
  const [data, setData] = useState<any>(null);

  const fetchData = async () => {
    if (!mcpApp?.callServerTool) return;

    // Use the built-in fetch_remote_resource tool to proxy the request through Node.js
    const result = await mcpApp.callServerTool({
      name: 'fetch_remote_resource',
      arguments: {
        url: 'https://api.example.com/data',
        method: 'GET',
        headers: { 'Authorization': 'Bearer token123' },
      },
    });

    if (!result.isError && result.content[0]?.text) {
      setData(JSON.parse(result.content[0].text));
    }
  };

  return (
    <div>
      <button onClick={fetchData}>Load data</button>
      {data && <pre>{JSON.stringify(data, null, 2)}</pre>}
    </div>
  );
};
```

> **Why `callServerTool` instead of a plain `fetch`?**
>
> Browser CORS policy blocks most cross-origin requests from inside an iframe. `callServerTool` forwards the request to the MCP Server (a Node.js process), which has no CORS restrictions and can reach any URL.
>
> If your target API already allows CORS, or you've added its domain to `csp.connectDomains`, a plain `fetch` works just fine.

---

## Pattern 4: Multi-step Wizard (component chaining)

Multiple tool components linked in sequence — each step automatically triggers the next. This is the most powerful pattern:

```
Step1 component → sendMessage to Agent → Agent calls step2 tool → Step2 component renders
```

```tsx
// DeployWizardStep1.tsx
const DeployWizardStep1: React.FC<{ mcpApp?: McpApp }> = ({ mcpApp }) => {
  const [selectedApp, setSelectedApp] = useState('');

  const handleNext = async () => {
    await mcpApp?.sendMessage({
      role: 'user',
      content: [{
        type: 'text',
        text: [
          'User completed Step 1. Please call tool `deploy_wizard_step2` immediately with these arguments:',
          '```json',
          JSON.stringify({ appId: selectedApp, confirmedAt: new Date().toISOString() }, null, 2),
          '```',
          'Call it directly — do not ask the user for confirmation.',
        ].join('\n'),
      }],
    });
  };

  return (
    <div>
      <select value={selectedApp} onChange={e => setSelectedApp(e.target.value)}>
        <option value="app-001">shop-web</option>
        <option value="app-002">admin-dashboard</option>
      </select>
      <button onClick={handleNext}>Next</button>
    </div>
  );
};
```

**Key tips**:
- **Name the tool explicitly** in the `sendMessage` text so the Agent knows exactly what to call
- Add "do not ask for confirmation" to prevent the Agent from inserting an unnecessary confirmation turn
- Set the tool's `description` to "Triggered automatically by StepX — do not call proactively" to prevent the Agent from calling it at the wrong time

---

## Component Lifecycle

```
Tool is called
  ↓
MCP App receives toolResult (config + args)
  ↓
useEffect fires, starts loading the MF component
  ↓
① vmok path: fetch vmok-snapshot.json → inject __VMOK__ → createInstance → loadRemote
② mf path:   createInstance (with mf-manifest.json as entry) → loadRemote
  ↓
Component mounts, rendered with {...args, mcpApp} as props
  ↓
User interaction → sendMessage / callServerTool
```

---

## Shared Dependencies

The MF `shared` config ensures the host and remote component use the same React instance, preventing Hook errors:

```typescript
// module-federation.config.ts
shared: {
  react: {
    singleton: true,          // only one React instance globally
    requiredVersion: '^18',
  },
  'react-dom': {
    singleton: true,
    requiredVersion: '^18',
  },
  // You can also share UI libraries like antd, arco, etc.
  // 'antd': { singleton: false, requiredVersion: '^5' },
}
```

> **Note**: The MCP host (`mcp-app.tsx`) already ships React 18 and react-dom 18 as shared singletons. Your remote component is compatible with React 18 or 19, but make sure the version range matches if you use specific Context API features.

---

## CSS and Styling

Components run inside an iframe — CSS is fully isolated, so you can freely use:

```tsx
// CSS Modules
import styles from './MyComponent.module.css';

// Tailwind (configured in your own project)
// styled-components / emotion
// Inline styles (simplest option)
```

**Note**: Do not rely on CSS variables from the host page — the iframe cannot access them.

---

## Troubleshooting

### `mcpApp` is `undefined`

- Confirm your component is being rendered by the MCP App (not a standalone dev page)
- For local development, provide a mock:

```tsx
const mockMcpApp: McpApp = {
  callServerTool: async ({ name, arguments: args }) => {
    console.log('[Mock] callServerTool:', name, args);
    return { content: [{ type: 'text', text: '{"mock": true}' }] };
  },
  sendMessage: async ({ content }) => {
    console.log('[Mock] sendMessage:', content[0]?.text);
    return {};
  },
};

<MyComponent mcpApp={mockMcpApp} />
```

### `Invalid hook call`

React singleton is not configured correctly. Make sure `module-federation.config.ts` has `react: { singleton: true }` and the version range matches the host (`^18`).

### `fetch` request fails inside component (CORS)

Add the domain to `csp.connectDomains` in `mcp_apps.json` (with the full protocol prefix), or switch to `mcpApp.callServerTool({ name: 'fetch_remote_resource', ... })` to route through the Node.js proxy.
