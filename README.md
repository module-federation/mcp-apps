# Module Federation MCP Apps

Bridge your existing Module Federation remotes to AI-native interactive UIs via the MCP Apps standard.

## Features

- ✅ Fully compliant with [MCP Apps](https://modelcontextprotocol.io/docs/extensions/apps) standard
- ✅ Dynamic tool registration from configuration
- ✅ CORS proxy for CDN resources
- ✅ Protocol-relative URL handling
- ✅ CSP configuration support
- ✅ AI-friendly Skills for configuration management

<video src="https://github.com/user-attachments/assets/8c9647ce-0398-41e3-b69d-f9fb420c31b5" controls width="100%"></video>

## Why Module Federation + MCP Apps

The [MCP Apps](https://modelcontextprotocol.io/docs/extensions/apps) standard lets AI hosts (Claude, VS Code, Goose, etc.) render interactive UI components inside conversations. But it raises a practical question: **where does the UI come from?**

The standard approach requires an MCP Server to provide a self-contained HTML resource — React, component code, and styles all bundled together. This means:

- UI components must be **extracted from your existing project** and rebuilt with a separate bundling pipeline
- Each MCP tool needs its own build artifact
- Updating a component requires rebuilding and redeploying the MCP Server's static assets
- Shared dependencies like React are duplicated across every tool's bundle

**Module Federation solves all of this by flipping the model.**

Instead of bundling UI into the MCP Server, the server holds a configuration file (`mcp_apps.json`) that points to your existing MF remotes. The UI lives where it already belongs — in your frontend deployment pipeline.

| | Standard MCP Apps | This project |
|---|---|---|
| **UI source** | Self-contained HTML bundle inside MCP Server | Existing MF remote, loaded dynamically from CDN |
| **Adding a new tool** | Extract component → create new build → redeploy server | Add one entry to `mcp_apps.json` |
| **Updating UI** | Rebuild bundle → redeploy server | Deploy new version to CDN, bump version in config |
| **Shared dependencies** | Duplicated per tool bundle | Shared across remotes via MF shared scope |
| **Granularity** | One bundle per tool | Any `exposes` entry — a button, a form, or an entire page |

In short: MF provides the UI delivery infrastructure that MCP Apps needs, without the overhead of maintaining a parallel build system for AI interfaces.

## Architecture

```
┌─────────────────┐
│   Claude AI     │
└────────┬────────┘
         │ MCP Protocol
         ▼
┌─────────────────────┐
│  MF MCP Server      │
│  - Load config      │
│  - Register tools   │
│  - Generate         │
│    ui://mf/<slug>   │
│    resource URIs    │
└────────┬────────────┘
         │ Returns resource URI (ui://mf/<slug>)
         │ Host fetches HTML for that URI
         ▼
┌──────────────────────┐
│ mf_render_container  │ (rendered as iframe)
│  - Load MF remote    │
│    from CDN          │
│  - Render component  │
│    with tool input   │
└──────────────────────┘
```

## Requirements

- **Node.js 18+**
- Claude Desktop (or any MCP host that supports the MCP Apps spec)

## Compatibility

| `@module-federation/mcp-apps` | MCP Apps spec (`@modelcontextprotocol/ext-apps`) | MCP SDK (`@modelcontextprotocol/sdk`) | Module Federation (`@module-federation/enhanced`) | Tested Claude Desktop |
|---|---|---|---|---|
| `0.0.x` | `^1.1.2` | `^1.27.1` | `^2.0.1` | 0.9.x (macOS) |

> The MCP Apps spec version this package implements is **1.1.x** (Streamable HTTP + `text/html;profile=mcp-app` resource MIME type).
> Hosts that do not support the MCP Apps spec still receive plain-text tool responses — the UI is simply not rendered.

## Try the Demo

The repo includes a ready-to-run Module Federation provider with a **Deploy Wizard** demo.

```bash
cd module-federation-examples/basic
pnpm install
pnpm run dev
# Runs on http://localhost:8080
```

Then register the MCP server with Claude Desktop — edit `~/Library/Application Support/Claude/claude_desktop_config.json`:

**Option 1: Using npx (recommended)**

```json
{
  "mcpServers": {
    "module-federation": {
      "command": "npx",
      "args": [
        "-y",
        "https://pkg.pr.new/@module-federation/mcp-apps@29a2cc7",
        "--config",
        "/absolute/path/to/module-federation-mcp/module-federation-examples/basic/mcp_apps.json",
        "--stdio"
      ]
    }
  }
}
```

> **nvm users:** Claude Desktop does not inherit your shell's PATH, so `npx` may resolve to the wrong Node version (e.g. an old v16). Use the full path to `npx` and pin PATH via `env`:
> ```bash
> which npx  # e.g. /Users/you/.nvm/versions/node/v22.21.1/bin/npx
> ```
> ```json
> {
>   "mcpServers": {
>     "module-federation": {
>       "command": "/Users/you/.nvm/versions/node/v22.21.1/bin/npx",
>       "args": [
>         "-y",
>         "https://pkg.pr.new/@module-federation/mcp-apps@29a2cc7",
>         "--config",
>         "/absolute/path/to/module-federation-mcp/module-federation-examples/basic/mcp_apps.json",
>         "--stdio"
>       ],
>       "env": {
>         "PATH": "/Users/you/.nvm/versions/node/v22.21.1/bin:/usr/local/bin:/opt/homebrew/bin:/usr/bin:/bin"
>       }
>     }
>   }
> }
> ```

**Option 2: Run from a local build**

```bash
# In the module-federation-mcp directory
pnpm install && pnpm run build
```

```json
{
  "mcpServers": {
    "module-federation": {
      "command": "/absolute/path/to/node",
      "args": [
        "/absolute/path/to/module-federation-mcp/dist/index.js",
        "--config",
        "/absolute/path/to/module-federation-mcp/module-federation-examples/basic/mcp_apps.json",
        "--stdio"
      ]
    }
  }
}
```

Replace `/absolute/path/to/...` with the actual absolute path on your machine. Restart Claude Desktop, then type:

```
Start a deployment
```

Claude will open the Deploy Wizard — a 3-step interactive UI running inside the chat.

---

## Use with Your Own Project

### 1. Create `mcp_apps.json`

Create a config file for your project (see [Configuration Reference](#configuration-reference) below), or use the [AI Skill](#generate-mcp_appsjson-with-ai) to generate it automatically.

### 2. Configure with AI Assistance (optional)

Use the included Skill to set up your configuration. The skill will **automatically detect** if your project is a Module Federation project and parse the configuration:

**For Module Federation Projects:**
```
You: Set up MCP for my MF project
AI: ✅ Detected module-federation.config.ts
    📦 Found package: @scope/your-package
    🔧 Found 3 exposed components
    [Asks for: version, CDN URL, locale]
    [Automatically generates tools from exposes]
```

**Supported Config Files:**
- `module-federation.config.ts`
- `rspack.config.js` / `webpack.config.js` (with ModuleFederationPlugin)

**For Non-MF Projects:**
```
You: Add MF tools to MCP
AI: ℹ️ Not a Module Federation project
    [Asks for: package name, version, CDN URL, components manually]
```

Or manually create `mcp_apps.json`:

```json
{
  "remotes": [
    {
      "name": "@scope/package",
      "version": "1.0.0",
      "baseUrl": "https://cdn.example.com/path",
      "locale": "en",
      "csp": {
        "connectDomains": ["cdn.example.com"],
        "resourceDomains": ["cdn.example.com"]
      }
    }
  ],
  "tools": [
    {
      "name": "my_tool",
      "title": "My Tool",
      "description": "Tool description",
      "inputSchema": {
        "type": "object",
        "properties": {},
        "required": []
      },
      "remote": "@scope/package",
      "module": "./ComponentName",
      "exportName": "default"
    }
  ]
}
```

### 3. Add to Claude Desktop

Edit `~/Library/Application Support/Claude/claude_desktop_config.json`:

**Option 1: Using npx (recommended)**

```json
{
  "mcpServers": {
    "module-federation": {
      "command": "npx",
      "args": [
        "-y",
        "https://pkg.pr.new/@module-federation/mcp-apps@29a2cc7",
        "--config",
        "/absolute/path/to/mcp_apps.json",
        "--stdio"
      ]
    }
  }
}
```

> **nvm users:** Claude Desktop does not inherit your shell's PATH, so `npx` may resolve to the wrong Node version (e.g. an old v16). Use the full path to `npx` and pin PATH via `env`:
> ```bash
> which npx  # e.g. /Users/you/.nvm/versions/node/v22.21.1/bin/npx
> ```
> ```json
> {
>   "mcpServers": {
>     "module-federation": {
>       "command": "/Users/you/.nvm/versions/node/v22.21.1/bin/npx",
>       "args": [
>         "-y",
>         "https://pkg.pr.new/@module-federation/mcp-apps@29a2cc7",
>         "--config",
>         "/absolute/path/to/mcp_apps.json",
>         "--stdio"
>       ],
>       "env": {
>         "PATH": "/Users/you/.nvm/versions/node/v22.21.1/bin:/usr/local/bin:/opt/homebrew/bin:/usr/bin:/bin"
>       }
>     }
>   }
> }
> ```

**Option 2: Run from a local build**

```bash
# In the module-federation-mcp directory
pnpm install && pnpm run build
```

```json
{
  "mcpServers": {
    "module-federation": {
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

### 4. Restart Claude Desktop

Your tools are now available!

## Generate `mcp_apps.json` with AI

This repo includes an AI Skill that automatically generates `mcp_apps.json` for your project. The skill works with any AI coding tool — Claude, Cursor, GitHub Copilot, Windsurf, Cline, etc.

### How it works

Point your AI assistant at [`skill/generate-mcp-apps-config.md`](./skill/generate-mcp-apps-config.md). The skill will:

- Auto-detect your MF config (`module-federation.config.ts`, `rspack.config.js`, `webpack.config.js`)
- Parse `name` and `exposes` to generate tool entries automatically
- Ask for CDN URL, version, and locale
- Create a complete, validated `mcp_apps.json`

### Usage by tool

**Claude (Projects or chat)**

Upload the entire `skill/` directory to your Claude Project, or paste into chat:
```
Use the instructions in skill/generate-mcp-apps-config.md to generate mcp_apps.json for my project.
```

**Cursor / Windsurf / Cline**

Add [`skill/generate-mcp-apps-config.md`](./skill/generate-mcp-apps-config.md) as context in the chat, then:
```
Follow skill/generate-mcp-apps-config.md to generate mcp_apps.json
```

**GitHub Copilot**

Attach the file via `#file:skill/generate-mcp-apps-config.md` in Copilot Chat, then ask it to generate the config.

**Any other AI tool**

The skill is plain Markdown — paste it directly into any chat or custom instruction field.

## Configuration Reference

### Remote Configuration

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | ✅ | Package name |
| `version` | string | ✅ | Package version |
| `baseUrl` | string | ✅ | CDN base URL |
| `locale` | string | ❌ | Locale (default: 'en') |
| `csp` | object | ❌ | CSP configuration |

### Tool Configuration

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | ✅ | Tool identifier |
| `title` | string | ❌ | Display name |
| `description` | string | ❌ | Tool description |
| `inputSchema` | object | ❌ | JSON Schema for input |
| `remote` | string | ✅ | Remote name |
| `module` | string | ✅ | Module Federation path |
| `exportName` | string | ❌ | Export name (default: 'default') |

## Usage

### With Claude Desktop

Already configured above. Tools will appear in Claude after restart.

## Development

```bash
# Install dependencies
npm install

# Build
npm run build

# Development with watch mode
npm run dev

# Type check
npm run typecheck
```

## How It Works

1. **Configuration Loading**: Server loads `mcp_apps.json` defining remotes and tools
2. **Tool Registration**: Each tool is registered with MCP protocol
3. **Resource Generation**: Server generates bundled HTML with MF runtime
4. **Component Loading**: When tool is called:
   - MCP host renders the HTML resource
   - Module Federation loads remote component from CDN
   - CORS proxy handles cross-origin requests
   - Component renders with tool input as props

## Troubleshooting

### Server Disconnected

If you see "Server disconnected" immediately after starting Claude Desktop, the most common cause with nvm is that Claude launches the MCP server with the wrong Node.js version.

Check the logs to confirm:
```bash
cat ~/Library/Logs/Claude/mcp-server-module-federation.log
```

If you see a `TypeError` from `@hono/node-server` or a warning about an unsupported Node version, follow the **nvm users** note in the [Option 1](#option-1-using-npx-recommended) config above to use the full path to `npx` and pin `PATH` via `env`.

### Tools Not Showing

1. Check configuration file path is absolute
2. Validate `mcp_apps.json` syntax
3. Restart Claude Desktop
4. Check logs: `~/Library/Logs/Claude/mcp-server-module-federation.log`

### Component Not Loading

1. Verify CDN URL is accessible
2. Check `csp.connectDomains` includes CDN domain
3. Verify module path matches Module Federation expose
4. Check browser console in Claude DevTools

### Configuration Errors

Validate manually:

```typescript
// Check remote exists
const remote = config.remotes.find(r => r.name === tool.remote);
if (!remote) {
  console.error('Remote not found');
}
```

## Examples

See [`mcp_apps.example.json`](./mcp_apps.example.json) for a complete example configuration.

## Using with Custom Agents (HTTP Mode)

The server also supports HTTP mode for agent frameworks that run the MCP client server-side and render UI in a browser. See [docs/integration-guide.md](./docs/integration-guide.md) for a detailed integration walkthrough.

---

## Related

- [MCP Apps SDK](https://github.com/modelcontextprotocol/ext-apps)
- [Module Federation](https://module-federation.io/)
- [MCP Protocol](https://modelcontextprotocol.io/)

## License

MIT
