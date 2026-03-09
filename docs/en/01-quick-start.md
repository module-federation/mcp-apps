# 01 · Quick Start

> Goal: Take a regular frontend project, wire it up, and see your component render inside Claude Desktop.

## Overview

```
Step 1  Add Module Federation config to your project
Step 2  Write an MCP-aware component
Step 3  Build & start locally (or deploy to a CDN)
Step 4  Generate mcp_apps.json with the AI Skill (just tell Claude "generate mcp_apps.json")
Step 5  Register with Claude Desktop
Step 6  Test
```

---

## Step 1: Add Module Federation to Your Project

### Install dependencies

```bash
# Rspack / Modern.js (recommended)
npm install @module-federation/modern-js-v3 --save-dev

# Webpack
npm install @module-federation/webpack --save-dev

# Vite
npm install @originjs/vite-plugin-federation --save-dev
```

### Create the MF config file

Create `module-federation.config.ts` in your project root:

```typescript
// module-federation.config.ts
import { createModuleFederationConfig } from '@module-federation/modern-js-v3';

export default createModuleFederationConfig({
  name: 'my_app',           // unique ID — only lowercase letters, digits, underscores
  exposes: {
    './HelloWidget': './src/components/HelloWidget.tsx',
    // register every component you want Claude to access
  },
  shared: {
    react: { singleton: true },
    'react-dom': { singleton: true },
  },
});
```

> **Naming rule**: `name` must be snake_case (e.g. `my_app`, `shop_frontend`). No `-` or `/` unless it is an npm scoped package name (e.g. `@cloud-public/my-package`).

### Reference it in your build tool

**Modern.js / Rspack:**

```typescript
// rspack.config.ts or modern.config.ts
import mfConfig from './module-federation.config';
import { ModuleFederationPlugin } from '@module-federation/rspack';

export default {
  plugins: [
    new ModuleFederationPlugin(mfConfig),
  ],
};
```

**Webpack:**

```javascript
// webpack.config.js
const { ModuleFederationPlugin } = require('@module-federation/webpack');
const mfConfig = require('./module-federation.config');

module.exports = {
  plugins: [
    new ModuleFederationPlugin(mfConfig),
  ],
};
```

---

## Step 2: Write Your First MCP Component

Create `src/components/HelloWidget.tsx`:

```tsx
import React from 'react';

interface HelloWidgetProps {
  // Props injected from mcp_apps.json inputSchema
  name?: string;

  // mcpApp is automatically injected by the MCP framework — no need to declare it in inputSchema
  // Use it to communicate with the Claude Agent
  mcpApp?: {
    sendMessage?: (params: {
      role: string;
      content: Array<{ type: string; text: string }>;
    }) => Promise<{ isError?: boolean }>;
    callServerTool?: (params: {
      name: string;
      arguments?: Record<string, unknown>;
    }) => Promise<{ content: Array<{ type: string; text?: string }>; isError?: boolean }>;
  };
}

const HelloWidget: React.FC<HelloWidgetProps> = ({ name = 'World', mcpApp }) => {
  const handleClick = async () => {
    if (!mcpApp?.sendMessage) return;

    await mcpApp.sendMessage({
      role: 'user',
      content: [{ type: 'text', text: `Button clicked! name=${name}` }],
    });
  };

  return (
    <div style={{ padding: '20px', fontFamily: 'system-ui' }}>
      <h2>Hello, {name}!</h2>
      <button onClick={handleClick}>Message Claude</button>
    </div>
  );
};

export default HelloWidget;
```

> **Key point**: `mcpApp` is automatically injected by the MCP framework at render time. Simply declare it in your component props and it's ready to use — no extra config needed.

---

## Step 3: Build and Start

```bash
# Build
npm run build

# Local dev server (e.g. port 3001)
npm run dev -- --port 3001
# or
npx serve dist -p 3001
```

The build output should contain:
- `mf-manifest.json` (MF module descriptor)
- Component chunk JS files

Verify it worked:
```bash
curl http://localhost:3001/mf-manifest.json
# Should return JSON containing "exposes"
```

---

## Step 4: Generate mcp_apps.json

`mcp_apps.json` is **auto-generated** by the built-in AI Skill — no manual editing needed. From your project root (where `module-federation.config.ts` lives), just tell Claude:

> "Generate mcp_apps.json"

The Skill will automatically:
1. Detect `module-federation.config.ts` and extract `name` and `exposes`
2. Ask for the CDN base URL, version, and locale
3. Generate a complete `mcp_apps.json` (with remotes, tools, and CSP config)
4. Copy `mcp_apps.schema.json` to your project root

**Example output:**
```json
{
  "$schema": "./mcp_apps.schema.json",
  "version": "1.0.0",
  "remotes": [
    {
      "name": "my_app",
      "version": "latest",
      "baseUrl": "http://localhost:3001",
      "locale": "en",
      "manifestType": "mf",
      "csp": {
        "connectDomains": ["http://localhost:3001"],
        "resourceDomains": ["http://localhost:3001"]
      }
    }
  ],
  "tools": [
    {
      "name": "hello_widget",
      "title": "Hello Widget",
      "description": "Renders a greeting component that can message Claude",
      "inputSchema": {
        "type": "object",
        "properties": {
          "name": {
            "type": "string",
            "description": "Name to greet",
            "default": "World"
          }
        }
      },
      "remote": "my_app",
      "module": "./HelloWidget",
      "exportName": "default"
    }
  ]
}
```

> **Adding more components later**: After adding new `exposes` entries, just say "Add NewComponent to mcp_apps.json" — the Skill appends the new tool without touching existing config.

> **Prefer writing it manually?** See [04 · Config Reference](./04-config-reference.md).

---

## Step 5: Register with Claude Desktop

Edit `~/Library/Application Support/Claude/claude_desktop_config.json`:

**Recommended: run the local node binary directly**

```json
{
  "mcpServers": {
    "my-mf-tools": {
      "command": "/absolute/path/to/node",
      "args": [
        "/absolute/path/to/module-federation-mcp/dist/index.js",
        "--config",
        "/absolute/path/to/mcp_apps.json",
        "--stdio"
      ]
    }
  }
}
```

> **Note**: All paths must be absolute. Use `which node` to get the node binary path and `pwd` to confirm your current directory.

**Via npx (requires Node 18+)**

Claude Desktop uses the system default PATH when spawning MCP servers. If your system Node version is older than 18 (check with `node -v`), explicitly point to a Node 18+ npx binary and override PATH:

```json
{
  "mcpServers": {
    "my-mf-tools": {
      "command": "/Users/yourname/.nvm/versions/node/v22.x.x/bin/npx",
      "args": [
        "-y",
        "@module-federation/mcp-server@latest",
        "--stdio"
      ],
      "env": {
        "MF_MCP_CONFIG": "/absolute/path/to/mcp_apps.json",
        "PATH": "/Users/yourname/.nvm/versions/node/v22.x.x/bin:/usr/local/bin:/usr/bin:/bin"
      }
    }
  }
}
```

> **Why override PATH?** When npx spawns a child process it inherits Claude Desktop's PATH. If an older Node version comes first, the child process runs with it, causing `@hono/node-server` compatibility errors. Putting Node 18+ first in `env.PATH` fixes this.

---

## Step 6: Test

1. Fully quit and restart Claude Desktop
2. Click the tools icon in the chat bar and confirm `hello_widget` appears
3. Tell Claude: "Call hello_widget with name set to Alice"
4. Claude should render your component

---

## Troubleshooting

### Tool doesn't appear in the Claude tools list

- Verify `claude_desktop_config.json` syntax: `python3 -m json.tool < ~/Library/Application\ Support/Claude/claude_desktop_config.json`
- Confirm `dist/index.js` exists: `ls /path/to/module-federation-mcp/dist/index.js`
- Check MCP server logs: `tail -f ~/Library/Logs/Claude/mcp-server-my-mf-tools.log`

### Server disconnected / `TypeError: Class extends value undefined`

Logs contain:

```
npm WARN EBADENGINE current: { node: 'v16.x.x' }
TypeError: Class extends value undefined is not a constructor or null
    at .../node_modules/@hono/node-server/dist/index.mjs
```

Claude Desktop used an old Node version (< 18) to run npx. Fix:

1. **Recommended**: switch to the direct `node` approach in Step 5
2. Or set `env.PATH` in `claude_desktop_config.json` to put Node 18+ first

### `TypeError: Failed to fetch` / RUNTIME-003

- Most common cause: domain in `connectDomains` is missing the protocol — use `"http://localhost:3001"` not `"localhost:3001"`
- Confirm your local server is running: `curl http://localhost:3001/mf-manifest.json`

### Component renders blank

- Open Claude DevTools (`Help → Enable Developer Mode` → `View → Toggle Developer Tools`)
- Check the Console for errors
- Common cause: `module` path doesn't match the `exposes` key — e.g. `exposes` has `./HelloWidget` but `module` is `./hellowidget` (case mismatch)
