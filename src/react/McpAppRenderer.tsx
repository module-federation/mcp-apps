import {
  AppBridge,
  PostMessageTransport,
} from '@modelcontextprotocol/ext-apps/app-bridge';
import { useEffect, useRef, useState } from 'react';

/**
 * The payload produced by the server-side enrichment layer and passed to {@link McpAppRenderer}.
 *
 * - `resourceHttpUrl` — preferred: an HTTP URL pointing to the MCP App HTML file
 *   (e.g. `http://localhost:3001/static/mcp-app.html`). The iframe is loaded with
 *   `src=` so it runs under a real origin, which is required for
 *   `history.pushState` and CSP `script-src` to work correctly in a real browser.
 * - `text` / `html` — fallback: raw HTML string loaded via `srcDoc=`.
 *   Works in Electron (Claude Desktop) but NOT in a real browser because
 *   `about:srcdoc` origin breaks `history.*` and CSP domain rules.
 * - `callToolResult` — the serialised `CallToolResult` payload that should be
 *   forwarded to the MCP App after the bridge initialises.
 * - `toolResult` — legacy alias for `callToolResult` (deprecated, use `callToolResult`).
 */
export interface McpAppResource {
  /** HTTP URL to load as iframe `src` (preferred for browser environments) */
  resourceHttpUrl?: string;
  /** Raw HTML string to load as iframe `srcDoc` (Electron / non-browser only) */
  text?: string;
  /** Raw HTML string to load as iframe `srcDoc` (alias for `text`) */
  html?: string;
  /** CallToolResult payload forwarded to the MCP App via AppBridge */
  callToolResult?: unknown;
  /** @deprecated use `callToolResult` */
  toolResult?: unknown;
}

export interface McpAppRendererProps {
  /** The McpAppResource payload from the server-side enrichment layer */
  uiResource: McpAppResource;
  /**
   * A unique ID for this tool call. Used as React `key` and effect dependency
   * so the bridge re-initialises on every new call, even when the same tool is
   * called twice in a row with identical content.
   */
  messageId?: string;
  /** Host application info passed to AppBridge */
  hostInfo?: { name: string; version: string };
  /** Initial iframe height in px (default: 400) */
  initialHeight?: number;
  /**
   * Called when the MCP App sends a ui/message request (e.g. to trigger the
   * next step in a multi-step flow). The host should relay this as a new chat
   * message so the agent can respond.
   */
  onMessage?: (params: { role: string; content: Array<{ type: string; text: string }> }) => void;
}

const DEFAULT_HOST_INFO = { name: 'mcp-app-host', version: '1.0.0' };

/**
 * Renders an MCP App inside an iframe and wires up the AppBridge communication
 * channel between the host page and the MCP App.
 *
 * ## Browser vs Electron
 *
 * In a real browser, always provide `uiResource.resourceHttpUrl` so the iframe
 * runs under a real HTTP origin. Using `srcDoc` in a browser sets the iframe
 * origin to `null` (`about:srcdoc`), which breaks `history.pushState` and CSP
 * `script-src` rules for dynamically loaded Module Federation chunks.
 *
 * In Electron (e.g. Claude Desktop) both `resourceHttpUrl` and `srcDoc` work.
 *
 * @example
 * ```tsx
 * <McpAppRenderer
 *   uiResource={uiResource}
 *   messageId={message.id}
 *   hostInfo={{ name: 'my-agent', version: '1.0.0' }}
 * />
 * ```
 */
export const McpAppRenderer = ({
  uiResource,
  messageId,
  hostInfo = DEFAULT_HOST_INFO,
  initialHeight = 400,
  onMessage,
}: McpAppRendererProps) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const bridgeRef = useRef<AppBridge | null>(null);
  const [height, setHeight] = useState(initialHeight);

  const html = uiResource?.text || uiResource?.html;
  const resourceHttpUrl = uiResource?.resourceHttpUrl;

  // Use messageId as the key effect dependency so the bridge re-initialises
  // on every new tool call — even when the same tool is called twice in a row
  // (html content and resourceHttpUrl would be identical, so they wouldn't
  // re-trigger the effect on their own).
  useEffect(() => {
    if ((!html && !resourceHttpUrl) || !iframeRef.current) {
      return;
    }

    const iframe = iframeRef.current;
    let cancelled = false;

    const onLoad = async () => {
      if (!iframe.contentWindow || cancelled) {
        return;
      }

      bridgeRef.current?.close?.();
      bridgeRef.current = null;

      const bridge = new AppBridge(
        null, // No MCP Client — tool calls are handled directly by the host
        hostInfo,
        { openLinks: {} },
        {
          hostContext: {
            theme: window.matchMedia('(prefers-color-scheme: dark)').matches
              ? 'dark'
              : 'light',
            platform: 'web',
            containerDimensions: { maxHeight: 6000 },
            displayMode: 'inline',
            availableDisplayModes: ['inline'],
          },
        },
      );
      bridgeRef.current = bridge;

      bridge.onsizechange = ({ height: h }) => {
        if (h !== undefined) setHeight(h);
      };

      bridge.onmessage = (params) => {
        onMessage?.(params as any);
        return Promise.resolve({});
      };

      bridge.onopenlink = ({ url }) => {
        window.open(url, '_blank', 'noopener,noreferrer');
        return Promise.resolve({});
      };

      // ⚠️ Must set oninitialized BEFORE connect() — the initialized event
      // fires during connect() and would be missed if set afterward.
      bridge.oninitialized = () => {
        // Defer so the app's React effects (useApp) finish running and
        // ontoolresult / ontoolinput handlers are registered before we send.
        // queueMicrotask is not enough — React effects run after paint, so we
        // need setTimeout(0) to push past the current event loop turn.
        setTimeout(() => {
          if (uiResource?.toolResult) {
            bridge.sendToolInput({ arguments: uiResource.toolResult as Record<string, unknown> });
          }
          if (uiResource?.callToolResult) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            bridge.sendToolResult(uiResource.callToolResult as any);
          }
        }, 0);
      };

      if (cancelled) return;
      await bridge.connect(
        new PostMessageTransport(iframe.contentWindow, iframe.contentWindow),
      );
    };

    iframe.addEventListener('load', onLoad);
    return () => {
      cancelled = true;
      iframe.removeEventListener('load', onLoad);
      bridgeRef.current?.close?.();
      bridgeRef.current = null;
    };
  }, [messageId]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!html && !resourceHttpUrl) {
    console.warn('[McpAppRenderer] No HTML content in uiResource:', uiResource);
    return (
      <div style={{ padding: 12, color: '#999' }}>
        Unable to render UI component (missing HTML content)
      </div>
    );
  }

  return (
    <iframe
      key={messageId}
      ref={iframeRef}
      {...(resourceHttpUrl ? { src: resourceHttpUrl } : { srcDoc: html! })}
      sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
      style={{ width: '100%', border: 'none', height }}
      title={`mcp-ui-${messageId}`}
    />
  );
};
