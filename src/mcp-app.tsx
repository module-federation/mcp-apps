import { useApp } from '@modelcontextprotocol/ext-apps/react';
import type { App } from '@modelcontextprotocol/ext-apps';
import { useState, useRef, useEffect, useCallback } from 'react';
import { createRoot } from 'react-dom/client';
import { DebugPanel, DebugToolbarButton } from './debug/debug-panel';
import { injectGlobalStyles } from './styles/styles';
import './utils/console-logger';
import { ErrorBoundary } from './components/error-boundary';
import type { AppData, ToolData } from './utils/types';
import { AppList } from './components/app-list';
import { RemoteComponentContainer } from './components/remote-component-container';
import { MFProvider } from './context/MFProvider';
import './styles/mcp-app.css';

// Inject global styles
injectGlobalStyles();

function ModuleFederationApp() {
  const [displayMode, setDisplayMode] = useState<'inline' | 'fullscreen'>('inline');
  const [apps, setApps] = useState<AppData[]>([]);
  const [currentTool, setCurrentTool] = useState<ToolData | null>(null);
  const [showMFComponent, setShowMFComponent] = useState(false);
  
  // Debug state (dev only)
  const [showDebugPanel, setShowDebugPanel] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  
  // Toggle fullscreen mode
  const toggleFullscreen = useCallback(async () => {
    if (!appRef.current) return;
    const newMode = displayMode === 'fullscreen' ? 'inline' : 'fullscreen';
    try {
      const result = await appRef.current.requestDisplayMode({ mode: newMode });
      setDisplayMode(result.mode as 'inline' | 'fullscreen');
      addLog(`📺 Switched to ${result.mode} mode`);
    } catch (err) {
      console.error('requestDisplayMode failed:', err);
      addLog(`❌ Failed to switch display mode`);
    }
  }, [displayMode]);
  
  // Exit fullscreen on ESC key
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && displayMode === 'fullscreen') {
        toggleFullscreen();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [displayMode, toggleFullscreen]);
  
  // Append a log entry (capped at 20 entries)
  const addLog = useCallback((msg: string) => {
    const timestamp = new Date().toLocaleTimeString();
    const logMsg = `[${timestamp}] ${msg}`;
    console.log(logMsg);
    setLogs(prev => [...prev, logMsg].slice(-20)); // Keep last 20 entries
  }, []);
  const appRef = useRef<App | null>(null);

  const { app, error, isConnected } = useApp({
    appInfo: {
      name: 'Module Federation',
      version: '1.0.0'
    },
    capabilities: {},
    onAppCreated: (app: App) => {
      appRef.current = app;
      
      // Handle host context changes
      app.onhostcontextchanged = (ctx: any) => {
        if (ctx.displayMode) {
          setDisplayMode(ctx.displayMode as 'inline' | 'fullscreen');
        }
      };

      // Handle tool input
      app.ontoolinput = async (_input: any) => {
        // setToolName(input.name || '');
      };

      // Handle tool result
      app.ontoolresult = (result: any) => {
        if (!result.content || !Array.isArray(result.content)) return;
        const textContent = result.content.find((c: any) => c.type === 'text');
        if (!textContent?.text) return;
        let parsed: any;
        try { parsed = JSON.parse(textContent.text); } catch { return; }

        // Handle app list
        if (Array.isArray(parsed)) {
          setApps(parsed); return;
        }
        if (parsed.apps) {
          setApps(parsed.apps); return;
        }

        // Handle tool with resource
        let resource: any = null;
        if (parsed.tool && parsed.resource) {
          resource = parsed.resource;
          setCurrentTool({ tool: parsed.tool, args: parsed.args ?? {}, config: { resource } });
        } else if (parsed.tool && parsed.config?.resource) {
          resource = parsed.config.resource;
          setCurrentTool(parsed);
        } else {
          return;
        }

        // Show component and trigger render
        console.log('[mcp-app] ✅ tool result received for', parsed.tool);
        setShowMFComponent(true);
      };

      app.onteardown = async () => ({});
      app.onerror = (err: any) => {
        const msg = err?.message || String(err);
        // Suppress known protocol noise: stale bridge receives initialize
        // response after iframe reload — harmless, not a real error
        if (msg.includes('unknown message ID')) return;
        console.error('[MF App] Error:', err);
      };
    },
  });



  if (error) {
    return (
      <div className="mf-error-container">
        <h1 className="mf-error-title">Connection Error</h1>
        <p className="mf-error-message">{error.message}</p>
      </div>
    );
  }

  if (!isConnected || !app) {
    return (
      <div className="mf-loading-container">
        <div>Connecting...</div>
      </div>
    );
  }

  return (
    <main className="mf-main">
      {/* Toolbar (top-right, visible on hover) */}
      <div className="mf-toolbar">
        <button
          className="mf-tool-btn"
          onClick={toggleFullscreen}
          title={displayMode === 'fullscreen' ? 'Exit fullscreen (ESC)' : 'Toggle fullscreen'}
          style={{
            color: displayMode === 'fullscreen' ? '#8b5cf6' : 'rgba(0, 0, 0, 0.6)'
          }}
        >
          ⛶
        </button>
        
        <DebugToolbarButton 
          showDebugPanel={showDebugPanel} 
          onToggle={() => setShowDebugPanel(!showDebugPanel)} 
        />
      </div>

      {/* Debug panel */}
      {showDebugPanel && (
        <DebugPanel
          isConnected={isConnected}
          app={app}
          showMFComponent={showMFComponent}
          currentTool={currentTool}
          onToggle={() => setShowDebugPanel(!showDebugPanel)}
        />
      )}

      <AppList apps={apps} displayMode={displayMode} />

      {/* Render remote component when tool is available */}
      {showMFComponent && currentTool?.config?.resource?.moduleFederation && (
        <RemoteComponentContainer
          config={currentTool.config.resource.moduleFederation}
          args={currentTool.args}
          mcpApp={app}
          onLog={addLog}
        />
      )}
    </main>
  );
}

createRoot(document.body).render(
  <ErrorBoundary>
    <MFProvider>
      <ModuleFederationApp />
    </MFProvider>
  </ErrorBoundary>
);