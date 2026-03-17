# Skill: Integrate MCP Apps (stdio)

Integrate `@module-federation/mcp-apps` into an existing project so that Module Federation / Vmok components become interactive UI tools in AI hosts (Claude Desktop, VS Code, etc.) via the MCP Apps standard.

**When to use this skill**: When you need to integrate mcp-apps, set up MCP Apps from scratch, connect MF/Vmok components to Claude Desktop, make components available as AI tools, register remote components as MCP tools, or expose frontend components to an AI agent.

> For custom Agent frameworks using HTTP mode, see `integrate-mcp-apps-http.md` instead.

---

## Overview

This skill walks through five stages:

1. **Detect project type** — Vmok or standard Module Federation
2. **Ensure MF remote is configured** — `exposes` + dev server running
3. **Generate `mcp_apps.json`** — one config file, no server code
4. **Start the MCP Server and register with the AI host** — single `npx` command
5. **Optionally enhance components** — `mcpApp` prop injection for AI communication

---

## Workflow Checklist

- [ ] **Step 1**: Detect project type ⚠️ REQUIRED
- [ ] **Step 2A or 2B**: Verify / create MF remote config
- [ ] **Step 3**: Generate `mcp_apps.json`
- [ ] **Step 4**: Start MCP Server & register AI host
- [ ] **Step 5**: (Optional) Add `mcpApp` prop to components

---

## Step 1: Detect Project Type

### Detection Order

Run in project root:

```bash
# Check for Vmok
ls vmok.config.ts edenx.config.ts 2>/dev/null
cat package.json | grep -E '"@edenx/plugin-vmok-v3"|"@edenx/plugin-vmok"|"@vmok/kit"'

# Check for standard MF
ls module-federation.config.ts module-federation.config.js 2>/dev/null
cat package.json | grep -E '"@module-federation/enhanced"|"@module-federation/core"|"@module-federation/modern-js-v3"'
```

### Decision

| Evidence | → Project Type |
|---|---|
| `vmok.config.ts` present OR `@edenx/plugin-vmok-v3` / `@edenx/plugin-vmok` / `@vmok/kit` in deps | **Vmok** → go to Step 2A |
| `module-federation.config.ts` present OR `@module-federation/enhanced` / `@module-federation/modern-js-v3` in deps | **Standard MF** → go to Step 2B |
| Neither | **No MF yet** → go to Step 2C |

**Confirm with user before proceeding** — e.g.:
```
Detected: Vmok project (vmok.config.ts found)
Proceeding with Vmok branch. Is this correct? [Y/n]
```

---

## Step 2A: Vmok Branch — Verify Remote Config

### 2A.1 Read `vmok.config.ts`

Vmok projects use **two config files**:
- `edenx.config.ts` — app/build config, loads `VmokPlugin`
- `vmok.config.ts` — Module Federation config via `createVmokConfig`, contains `name` and `exposes`

Read `vmok.config.ts` for the exposes:

```ts
// vmok.config.ts
import { createVmokConfig } from '@edenx/plugin-vmok-v3';

export default createVmokConfig({
  name: '@demo/provider',   // ← this is the remote name
  exposes: {
    '.': './src/logo.tsx',
    './button': './src/button.tsx',
  },
  shared: {
    react: { singleton: true },
    'react-dom': { singleton: true },
  },
});
```

If `exposes` is missing or empty, ask the user which components to expose and add them.

### 2A.2 Determine `baseUrl`

**Option A — Local dev** (recommended for first-time setup):
```
baseUrl = http://localhost:{devPort}/vmok-manifest.json
```
Ask: `What port does your Vmok dev server run on? (default: 8080)`

**Option B — Published to Vmok Module Center** (production):
- Ask user to look up the module URL in the Vmok Module Center
- Format: `https://{cdn-host}/{scope}/{package-name}/{version}/vmok-manifest.json`

**Key rule**: Vmok `baseUrl` must end with `/vmok-manifest.json`.

### 2A.3 Note the package name

Read `name` from **`vmok.config.ts`** (the `name` field inside `createVmokConfig`) — this becomes `remotes[].name` in `mcp_apps.json`. Do **not** use `package.json` name here.

→ Proceed to **Step 3**.

---

## Step 2B: Standard MF Branch — Verify Remote Config

### 2B.1 Read `module-federation.config.ts`

The config format depends on the build tool. Both use the same `name` / `exposes` shape:

**Rspack / Webpack** (`@module-federation/enhanced`):

```ts
// module-federation.config.ts
import { createModuleFederationConfig } from '@module-federation/enhanced/rspack';

export default createModuleFederationConfig({
  name: '@my-org/ops-tools',
  exposes: {
    './IncidentForm': './src/components/IncidentForm',
    './UserLookup': './src/components/UserLookup',
  },
  shared: { react: { singleton: true }, 'react-dom': { singleton: true } },
});
```

**Modern.js** (`@module-federation/modern-js-v3`) — also requires `moduleFederationPlugin()` in `modern.config.ts`:

```ts
// module-federation.config.ts
import { createModuleFederationConfig } from '@module-federation/modern-js-v3';

export default createModuleFederationConfig({
  name: '@my-org/ops-tools',
  exposes: {
    './IncidentForm': './src/components/IncidentForm',
    './UserLookup': './src/components/UserLookup',
  },
  shared: { react: { singleton: true }, 'react-dom': { singleton: true } },
});
```

If `exposes` is missing, ask which components to expose and add them.

### 2B.2 Determine `baseUrl`

**Option A — Local dev**:
```
baseUrl = http://localhost:{devPort}/mf-manifest.json
```
Ask: `What port does your MF dev server run on? (default: 8080)`

**Option B — CDN (production)**:
Ask: `What is the CDN base URL for this package?`
Example: `https://cdn.example.com/ops-tools/2.4.1`
Then append `/mf-manifest.json` → `https://cdn.example.com/ops-tools/2.4.1/mf-manifest.json`

**Key rule**: Standard MF `baseUrl` must end with `/mf-manifest.json`.

### 2B.3 Note the package name

Read `name` from `module-federation.config.ts` (not `package.json`) — this is the MF remote name.

→ Proceed to **Step 3**.

---

## Step 2C: No MF Config — Guide Initial Setup

Ask the user their build tool:

```
Which build tool does your project use?
  1. Rspack / Webpack
  2. Modern.js
  3. Vite
  4. I'm using Vmok (internal ByteDance framework)
```

**For Rspack/Webpack**, add `@module-federation/enhanced`:

```bash
pnpm add @module-federation/enhanced
```

Create `module-federation.config.ts`:

```ts
import { createModuleFederationConfig } from '@module-federation/enhanced/rspack';

export default createModuleFederationConfig({
  name: '@my-org/app-name',   // ← fill in
  exposes: {
    './MyComponent': './src/components/MyComponent',  // ← fill in
  },
  shared: { react: { singleton: true }, 'react-dom': { singleton: true } },
});
```

**For Modern.js**, add `@module-federation/modern-js-v3`:

```bash
pnpm add @module-federation/modern-js-v3
```

Register the plugin in `modern.config.ts`:

```ts
import { appTools, defineConfig } from '@modern-js/app-tools';
import { moduleFederationPlugin } from '@module-federation/modern-js-v3';

export default defineConfig({
  plugins: [appTools(), moduleFederationPlugin()],
});
```

Create `module-federation.config.ts`:

```ts
import { createModuleFederationConfig } from '@module-federation/modern-js-v3';

export default createModuleFederationConfig({
  name: '@my-org/app-name',   // ← fill in
  exposes: {
    './MyComponent': './src/components/MyComponent',  // ← fill in
  },
  shared: { react: { singleton: true }, 'react-dom': { singleton: true } },
});
```

**For Vite**, install `@originjs/vite-plugin-federation` and configure per its docs.

**For Vmok**, refer to the Vmok quick-start guide (`vmok.config.ts` setup).

After setup, re-run Step 1 to confirm detection, then proceed to **Step 2A or 2B**.

---

## Step 3: Generate `mcp_apps.json`

Use **`generate-mcp-apps-config.md`** skill for full detail. Summary:

### 3.1 Copy schema

```bash
cp node_modules/@module-federation/mcp-apps/mcp_apps.schema.json ./mcp_apps.schema.json
# or if not yet installed, use the schema from the repo:
# https://raw.githubusercontent.com/module-federation/mcp-apps/main/mcp_apps.schema.json
```

### 3.2 Construct `mcp_apps.json`

**Vmok project** (`baseUrl` ends with `/vmok-manifest.json`):

```json
{
  "$schema": "./mcp_apps.schema.json",
  "remotes": [
    {
      "name": "<value from vmok.config.ts 'name' field in createVmokConfig>",
      "version": "<package version or 'local'>",
      "baseUrl": "http://localhost:8080/vmok-manifest.json",
      "locale": "zh",
      "csp": {
        "connectDomains": ["http://localhost:8080"],
        "resourceDomains": ["http://localhost:8080"]
      }
    }
  ],
  "tools": [
    {
      "name": "<snake_case_tool_name>",
      "title": "<Human Readable Title>",
      "description": "<what this tool does, shown to the AI>",
      "inputSchema": { "type": "object", "properties": {} },
      "remote": "<same as remotes[].name>",
      "module": "./MyComponent"
    }
  ]
}
```

**Standard MF project** (`baseUrl` ends with `/mf-manifest.json`):

```json
{
  "$schema": "./mcp_apps.schema.json",
  "remotes": [
    {
      "name": "<value from module-federation.config.ts 'name'>",
      "version": "<version or 'local'>",
      "baseUrl": "http://localhost:8080/mf-manifest.json",
      "csp": {
        "connectDomains": ["http://localhost:8080"],
        "resourceDomains": ["http://localhost:8080"]
      }
    }
  ],
  "tools": [
    {
      "name": "<snake_case_tool_name>",
      "title": "<Human Readable Title>",
      "description": "<what this tool does, shown to the AI>",
      "inputSchema": { "type": "object", "properties": {} },
      "remote": "<same as remotes[].name>",
      "module": "./MyComponent"
    }
  ]
}
```

### 3.3 Naming rules

- `tools[].name`: Remove `./` prefix, convert PascalCase → snake_case (e.g. `./IncidentForm` → `incident_form`)
- `tools[].description`: Written for the AI model — describe what the tool does and when to call it
- CSP domains must include the full origin (protocol + host + port) of `baseUrl`

### 3.4 Validate

```bash
node -e "JSON.parse(require('fs').readFileSync('mcp_apps.json', 'utf8')); console.log('✅ valid JSON')"
```

---

## Step 4: Start MCP Server and Register with AI Host

### 4.1 Start the dev server (if not already running)

Vmok:
```bash
pnpm run dev   # or the project's dev command
```

Standard MF:
```bash
pnpm run dev   # MF remote dev server — confirm it's accessible at the configured port
```

Verify `remoteEntry` / manifest is reachable:
```bash
# Vmok
curl http://localhost:8080/vmok-manifest.json

# Standard MF
curl http://localhost:8080/mf-manifest.json
```

### 4.2 Register with Claude Desktop

Edit `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) or `%APPDATA%\Claude\claude_desktop_config.json` (Windows):

```json
{
  "mcpServers": {
    "module-federation": {
      "command": "npx",
      "args": [
        "-y",
        "@module-federation/mcp-apps@latest",
        "--config",
        "/absolute/path/to/mcp_apps.json",
        "--stdio"
      ]
    }
  }
}
```

**nvm users** — Claude Desktop doesn't inherit shell PATH. Use absolute `npx` path:

```bash
which npx   # e.g. /Users/you/.nvm/versions/node/v22.x.x/bin/npx
```

```json
{
  "mcpServers": {
    "module-federation": {
      "command": "/Users/you/.nvm/versions/node/v22.x.x/bin/npx",
      "args": ["-y", "@module-federation/mcp-apps@latest", "--config", "/absolute/path/to/mcp_apps.json", "--stdio"],
      "env": {
        "PATH": "/Users/you/.nvm/versions/node/v22.x.x/bin:/usr/local/bin:/usr/bin:/bin"
      }
    }
  }
}
```

### 4.3 Restart and verify

1. Fully quit and restart Claude Desktop
2. Ask: **"What MCP tools do you have?"**
3. Confirm the tool names from `mcp_apps.json` appear in the response
4. Test: ask the AI to invoke one of the tools by name

---

## Step 5: (Optional) Add `mcpApp` Prop for AI Communication

Skip this step if the component just needs to render — no AI interaction required.

**When you need it**: multi-step wizards, submitting data back to the conversation, triggering the next tool call.

### How it works

`mcpApp` is **injected as a prop by the MCP Apps framework at render time**. No package to install, no import needed. Just declare the interface and use it:

```tsx
// No import required — mcpApp is injected by the framework
interface McpApp {
  sendMessage?: (params: {
    role: string;
    content: Array<{ type: string; text: string }>;
  }) => Promise<{ isError?: boolean }>;
}

export default function MyComponent({ mcpApp }: { mcpApp?: McpApp }) {
  const handleSubmit = async (data) => {
    // ... your existing logic ...

    // Notify the AI what happened
    await mcpApp?.sendMessage({
      role: 'user',
      content: [{ type: 'text', text: `Action completed: ${data.summary}` }],
    });
  };

  return <YourUI onSubmit={handleSubmit} />;
}
```

**Safe to use without guards** — when running outside an MCP host (e.g. your normal app), `mcpApp` is `undefined` and the optional chain `?.` silently skips the call. Existing behavior is unaffected.

---

## Verification Checklist

- [ ] Dev server running and manifest URL accessible (`curl` test passes)
- [ ] `mcp_apps.json` is valid JSON with correct `baseUrl` suffix:
  - Vmok: ends with `/vmok-manifest.json`
  - Standard MF: ends with `/mf-manifest.json`
- [ ] Claude Desktop config points to correct absolute path for `mcp_apps.json`
- [ ] After restart, AI lists the expected tool names
- [ ] Invoking a tool from Claude renders the component in a chat iframe

---

## Common Issues

**Tool not appearing after restart**
- Check Claude Desktop config path is absolute, not relative
- Confirm `npx` resolves to the correct Node version (`node --version`)
- Run manually to check for errors:
  ```bash
  npx -y @module-federation/mcp-apps@latest --config /path/to/mcp_apps.json --stdio
  ```

**Component loads but shows blank / CSP error**
- Open DevTools in the iframe, check the Console for blocked URLs
- Add missing origins to `csp.connectDomains` and `csp.resourceDomains` in `mcp_apps.json`
- Restart Claude Desktop after changing `mcp_apps.json` (the server re-reads config on startup)

**`remoteEntry` / manifest not found (404)**
- Vmok: confirm dev server is running and path is `/vmok-manifest.json` (not `/remoteEntry.js`)
- Standard MF: confirm path is `/mf-manifest.json` (not `/remoteEntry.js`)
- Check `baseUrl` doesn't have a trailing slash before the manifest filename

**nvm / node not found in Claude Desktop**
- Use the absolute path to `npx` from `which npx`
- Set the `env.PATH` field in the Claude Desktop config as shown in Step 4.2

---

## Next Steps

- **Production deployment**: Replace `localhost` `baseUrl` with your CDN URL + bump the version string in `mcp_apps.json`
- **Add more tools**: Use `generate-mcp-apps-config.md` skill (Add Module Flow) to append new tools without touching existing ones
- **Custom Agent / HTTP mode**: See `integrate-mcp-apps-http.md` for running the server in HTTP mode for custom Agent frameworks
