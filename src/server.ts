import { registerAppResource, registerAppTool, getUiCapability, RESOURCE_MIME_TYPE } from '@modelcontextprotocol/ext-apps/server';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import fs from 'node:fs/promises';
import path from 'node:path';
import { jsonSchemaToZod } from './utils/schema-converter.js';
import { validateConfig, type McpAppsConfig } from './utils/config-validator.js';

// Works both from source (src/server.ts) and compiled (dist/server.js)
const DIST_DIR = import.meta.filename.endsWith(".ts")
  ? path.join(import.meta.dirname, "..", "dist")
  : import.meta.dirname;

// Cache mcp-app.html content to avoid reading from disk on every resources/read request.
// In dev mode (--dev flag or NODE_ENV=development) caching is disabled so that
// rebuilding the UI is visible immediately without restarting the MCP server.
let cachedMcpAppHtml: string | null = null;
// Cache for the shell HTML (HTTP mode). The placeholder __MF_MCP_BASE__ is already
// replaced with the actual base URL when stored here.
let cachedShellHtml: string | null = null;

async function getMcpAppHtml(devMode: boolean, shellBaseUrl?: string): Promise<string> {
  // HTTP mode: serve the tiny shell HTML (~1 KB) that loads JS from
  // /static/js/mcp-app.js via an absolute URL.  Falls back to the full
  // inline HTML if the shell file doesn't exist (e.g. old build artefact).
  if (shellBaseUrl) {
    if (devMode || !cachedShellHtml) {
      const shellPath = path.join(DIST_DIR, 'mcp-app-shell.html');
      try {
        const raw = await fs.readFile(shellPath, 'utf-8');
        // Replace the build-time placeholder with the real server origin.
        const shell = raw.replaceAll('__MF_MCP_BASE__', shellBaseUrl);
        if (!devMode) cachedShellHtml = shell;
        const logLabel = devMode ? '🔄 [dev] Re-read' : '📂 Loaded';
        console.error(`[MF MCP] ${logLabel} mcp-app-shell.html (${shell.length} bytes, base: ${shellBaseUrl})`);
        return shell;
      } catch {
        console.error('[MF MCP] ⚠️  mcp-app-shell.html not found, falling back to full mcp-app.html. Run `pnpm build:ui` to generate the shell.');
        // fall through to full HTML
      }
    } else if (cachedShellHtml) {
      return cachedShellHtml;
    }
  }

  if (devMode) {
    // Always re-read from disk in dev mode
    const htmlPath = path.join(DIST_DIR, 'mcp-app.html');
    const html = await fs.readFile(htmlPath, 'utf-8');
    console.error(`[MF MCP] 🔄 [dev] Re-read mcp-app.html (${html.length} bytes)`);
    return html;
  }
  if (!cachedMcpAppHtml) {
    const htmlPath = path.join(DIST_DIR, 'mcp-app.html');
    cachedMcpAppHtml = await fs.readFile(htmlPath, 'utf-8');
    console.error(`[MF MCP] 📂 Loaded mcp-app.html from disk (${cachedMcpAppHtml.length} bytes)`);
  }
  return cachedMcpAppHtml;
}

// Load configuration
async function loadConfig(configPath: string): Promise<McpAppsConfig> {
  try {
    const content = await fs.readFile(configPath, 'utf-8');
    const rawConfig = JSON.parse(content);
    
    // Validate configuration
    const validation = validateConfig(rawConfig);
    if (!validation.valid) {
      console.error(`[MF MCP] ❌ Configuration validation failed:`);
      validation.errors.forEach((err: { path: string; message: string }) => {
        console.error(`  - ${err.path}: ${err.message}`);
      });
      throw new Error(`Invalid configuration format. See errors above.`);
    }
    
    console.error(`[MF MCP] ✅ Configuration validated successfully`);
    return rawConfig;
  } catch (error) {
    if (error instanceof SyntaxError) {
      console.error(`[MF MCP] ❌ Invalid JSON syntax in ${configPath}`);
      throw new Error(`Invalid JSON in configuration file: ${error.message}`);
    }
    throw error;
  }
}

export interface CreateServerOptions {
  configPath: string;
  /**
   * When true, mcp-app.html is re-read from disk on every resources/read
   * request instead of being served from the in-memory cache.
   * Enable with `--dev` CLI flag or `NODE_ENV=development`.
   */
  devMode?: boolean;
  /**
   * HTTP server base URL (e.g. `http://localhost:3001`).
   * When set, `resources/read` returns the tiny `mcp-app-shell.html` (~1 KB)
   * that loads JS/CSS from `{shellBaseUrl}/static/...` instead of the full
   * self-contained 686 KB inline HTML.
   * Leave undefined in stdio mode (no HTTP server available).
   */
  shellBaseUrl?: string;
}

/**
 * Create and configure the MCP server
 */
export async function createServer({ configPath, devMode = false, shellBaseUrl }: CreateServerOptions): Promise<McpServer> {
  if (devMode) {
    console.error('[MF MCP] ⚡ Dev mode enabled — mcp-app.html cache disabled. Rebuild the UI to see changes without restarting.');
  }
  if (shellBaseUrl) {
    console.error(`[MF MCP] 🌐 HTTP mode — UI loaded from ${shellBaseUrl}/static (shell HTML, not inline)`);
  }

  const config = await loadConfig(configPath);
  
  const server = new McpServer({
    name: 'module-federation',
    version: '1.0.0',
  });

  console.error(`[MF MCP] Loaded ${config.tools.length} tools from config`);

  // Pre-build a map of remote name → resource URI for O(1) lookup.
  // Each remote gets its own resource URI so CSP is scoped to that remote only.
  // URI scheme: ui://mf/<remote-name-slug>  (mf:// causes Claude Desktop to hang)
  const remoteResourceUriMap = new Map<string, string>();
  for (const remoteConfig of config.remotes) {
    const slug = remoteConfig.name.replace(/[^a-z0-9]/gi, '-').toLowerCase();
    remoteResourceUriMap.set(remoteConfig.name, `ui://mf/${slug}`);
  }

  // Build tool handler — shared between UI and text-only registrations
  const makeToolHandler = (toolConfig: McpAppsConfig['tools'][number]) =>
    async (args: unknown): Promise<CallToolResult> => {
      const typedArgs = (args ?? {}) as Record<string, unknown>;
      console.error(`[MF MCP] ${toolConfig.name} called with:`, typedArgs);

      const remoteConfig = config.remotes.find((r: any) => r.name === toolConfig.remote);
      if (!remoteConfig) {
        return {
          content: [{ type: 'text', text: `Error: Remote "${toolConfig.remote}" not found in config` }],
          isError: true,
        };
      }

      const { baseUrl, manifestType = 'mf', snapshotUrl } = remoteConfig;
      const remoteEntry = baseUrl;

      const resourceConfig = {
        mimeType: 'text/html;profile=mcp-app',
        moduleFederation: {
          remoteName: toolConfig.remote,
          remoteEntry,
          snapshotUrl,
          module: toolConfig.module,
          exportName: toolConfig.exportName || 'default',
          manifestType,
          // The HTTP base URL of this MCP server (undefined in stdio mode).
          // Hosts use this to forward callServerTool requests back to the server.
          mcpServerUrl: shellBaseUrl,
        },
        csp: remoteConfig.csp,
      };

      const payload = { tool: toolConfig.name, resource: resourceConfig, args: typedArgs };
      return {
        content: [{ type: 'text', text: JSON.stringify(payload) }],
        structuredContent: payload,
      };
    };

  // Register tools at server creation time (before connect).
  // Tools must be registered before the first transport connection so that
  // tools/list and tools/call handlers are set up correctly.
  // Capability negotiation (oninitialized) happens after connect, which is
  // too late for registerTool — the SDK requires handlers to be set before connect.
  //
  // Per the MCP Apps spec, hosts that don't support UI simply ignore _meta.ui,
  // so registering UI tools unconditionally is safe and backward-compatible.
  // Log which mode the host is using for observability.
  server.server.oninitialized = () => {
    const clientCaps = server.server.getClientCapabilities();
    const uiCap = getUiCapability(clientCaps);
    console.error(`[MF MCP] Host UI capability: ${uiCap ? 'supported' : 'not supported (tools still work, UI will not render)'}`);
  };

  for (const toolConfig of config.tools) {
    const inputSchema = jsonSchemaToZod(toolConfig.inputSchema || {});
    const visibility: Array<'model' | 'app'> = toolConfig.visibility ?? ['model', 'app'];
    const visibleToModel = visibility.includes('model');

    registerAppTool(
      server,
      toolConfig.name,
      {
        title: toolConfig.title,
        description: visibleToModel ? toolConfig.description : `[app-only] ${toolConfig.description}`,
        inputSchema,
        annotations: { readOnlyHint: true },
        _meta: {
          ui: {
            resourceUri: remoteResourceUriMap.get(toolConfig.remote) ?? 'ui://mf/app',
            visibility,
          },
        },
      },
      makeToolHandler(toolConfig),
    );
  }

  console.error(`[MF MCP] ✅ Registered ${config.tools.length} tools`);

  // Register one resource per remote — each gets its own URI and scoped CSP.
  // This avoids granting every iframe the union of ALL remotes' domains.
  for (const remoteConfig of config.remotes) {
    const uri = remoteResourceUriMap.get(remoteConfig.name)!;
    const csp = {
      connectDomains: remoteConfig.csp?.connectDomains ?? [],
      resourceDomains: remoteConfig.csp?.resourceDomains ?? [],
      ...(remoteConfig.csp?.frameDomains?.length ? { frameDomains: remoteConfig.csp.frameDomains } : {}),
      ...(remoteConfig.csp?.baseUriDomains?.length ? { baseUriDomains: remoteConfig.csp.baseUriDomains } : {}),
    };
    console.error(`[MF MCP] 📋 Resource ${uri} CSP connectDomains:`, csp.connectDomains);

    registerAppResource(
      server,
      `mf-app-${remoteConfig.name}`,
      uri,
      { mimeType: RESOURCE_MIME_TYPE },
      async () => {
        console.error('[MF MCP] 📖 Resource requested:', uri);
        const html = await getMcpAppHtml(devMode, shellBaseUrl);
        return {
          contents: [{ uri, mimeType: RESOURCE_MIME_TYPE, text: html, _meta: { ui: { csp, prefersBorder: true } } }],
        };
      }
    );
  }

  console.error(`[MF MCP] ✅ Registered ${config.remotes.length} resources (one per remote)`);

  console.error('[MF MCP] Server initialized');
  return server;
}
