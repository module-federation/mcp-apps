# Module Federation Demo

This is the demo Module Federation provider for [module-federation-mcp-server](../../README.md). It exposes the **Deploy Wizard** as an interactive MCP App inside Claude Desktop.

## Setup

```bash
pnpm install
```

## Start the MF demo

```bash
pnpm dev
# Runs on http://localhost:8080
```

## Register with Claude Desktop

Edit `~/Library/Application Support/Claude/claude_desktop_config.json` and add:

**Option 1: Using npx (recommended, once published)**

```json
{
  "mcpServers": {
    "mf-demo": {
      "command": "npx",
      "args": [
        "-y",
        "@module-federation/mcp-server@latest",
        "--config",
        "/absolute/path/to/module-federation-mcp/module-federation-examples/basic/mcp_apps.json",
        "--stdio"
      ]
    }
  }
}
```

**Option 2: Run from a local build**

```bash
# In the module-federation-mcp directory
pnpm install && pnpm run build
```

```json
{
  "mcpServers": {
    "mf-demo": {
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

Replace `/absolute/path/to/...` with the actual absolute path to this directory's `mcp_apps.json`. Then restart Claude Desktop.

Claude Desktop will **automatically start** the MCP server — you don't need to run `pnpm mcp` manually.

> **Note:** Make sure `pnpm dev` is running on port 8080 before testing in Claude.

### Debug: run the MCP server manually

```bash
pnpm mcp
```

This runs `mf-mcp-server --config ./mcp_apps.json --stdio` directly in your terminal. Useful when:

- You want to verify the server starts without errors before configuring Claude Desktop
- You changed `mcp_apps.json` and want to test quickly without restarting Claude Desktop
- You need to see server logs / error output

## Test in Claude

With `pnpm dev` running and Claude Desktop configured, type:

```
Start a deployment
Help me deploy an application
```

Claude will open the Deploy Wizard — a 3-step interactive UI running inside the chat.

## Exposed components

| Module | Description |
|--------|-------------|
| `./DeployWizardStep1` | Step 1 — select app and environment |
| `./DeployWizardStep2` | Step 2 — confirm deploy configuration |
| `./DeployWizardStep3` | Step 3 — deployment progress display |
