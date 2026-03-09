/**
 * Public types for Module Federation MCP component development.
 *
 * Import in your component:
 *   import type { McpApp, McpAppProps } from '@module-federation/mcp-server/types';
 */

/**
 * The `mcpApp` prop automatically injected by the MCP framework into every
 * rendered Module Federation component.
 *
 * You do NOT need to declare it in `inputSchema` — just add it to your
 * component's props interface and it will be available at runtime.
 */
export interface McpApp {
  /**
   * Call any tool registered on the MCP Server.
   *
   * Useful for:
   * - Calling the built-in `fetch_remote_resource` tool as a CORS proxy
   * - Calling your own custom server-side tools
   * - Calling other MCP App tools with `visibility: ["app"]`
   *
   * @example
   * const result = await mcpApp.callServerTool({
   *   name: 'fetch_remote_resource',
   *   arguments: { url: 'https://api.example.com/data', method: 'GET' },
   * });
   */
  callServerTool: (params: {
    name: string;
    arguments?: Record<string, unknown>;
  }) => Promise<{
    content: Array<{ type: string; text?: string }>;
    isError?: boolean;
  }>;

  /**
   * Send a message into the Claude conversation as if the user typed it.
   *
   * The Agent will respond to this message (call tools, answer questions, etc.).
   * Use this to chain components: after user action in component A, send a
   * message instructing Claude to call component B's tool.
   *
   * @example
   * await mcpApp.sendMessage({
   *   role: 'user',
   *   content: [{ type: 'text', text: 'User clicked Submit. Please call tool `next_step`.' }],
   * });
   */
  sendMessage?: (params: {
    role: 'user';
    content: Array<{ type: 'text'; text: string }>;
  }) => Promise<{ isError?: boolean }>;

  /**
   * Request the MCP host to switch display mode.
   *
   * Whether the request is honoured depends on the host implementation
   * (e.g. Claude Desktop). The host may ignore it.
   *
   * @example
   * const result = await mcpApp.requestDisplayMode({ mode: 'fullscreen' });
   * console.log(result.mode); // 'fullscreen' or 'inline'
   */
  requestDisplayMode?: (params: {
    mode: 'inline' | 'fullscreen';
  }) => Promise<{ mode: string }>;
}

/**
 * Base props interface for any Module Federation MCP component.
 *
 * Extend this to add your own tool-specific props defined in `inputSchema`.
 *
 * @example
 * interface MyWidgetProps extends McpAppProps {
 *   name?: string;   // declared in inputSchema
 *   count?: number;  // declared in inputSchema
 * }
 */
export interface McpAppProps {
  /** Automatically injected by the MCP framework — do not declare in inputSchema. */
  mcpApp?: McpApp;
}
