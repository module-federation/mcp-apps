import '../styles/debug-panel.css';

interface DebugPanelProps {
  isConnected: boolean;
  app: any;
  showMFComponent: boolean;
  isLoadingMF?: boolean;
  RemoteComponent?: any;
  mfError?: string | null;
  logs?: string[];
  currentTool?: any;
  resources?: any[];

  onToggle: () => void;
}

export function DebugPanel({
  isConnected,
  app,
  showMFComponent,
  isLoadingMF = false,
  RemoteComponent = null,
  mfError = null,
  logs = [],
  currentTool = null,
  resources = [],

}: DebugPanelProps) {
  return (
    <>
      {/* Live status */}
      <div className="debug-status-panel">
        <div className="debug-status-title">📊 Status</div>
        <div className="debug-status-items">
          <span>{isConnected ? '✅ Connected' : '❌ Disconnected'}</span>
          <span>{app ? '✅ MCP' : '❌ MCP'}</span>

          <span>{showMFComponent ? '✅ Visible' : '⏸️ Hidden'}</span>
          <span>{isLoadingMF ? '⏳ Loading' : RemoteComponent ? '✅ Loaded' : '⏸️ Waiting'}</span>
          {mfError && <span className="debug-status-error">❌ {mfError.substring(0, 30)}...</span>}
        </div>
      </div>

      {/* Log panel */}
      <div className="debug-log-panel">
        <div className="debug-log-title">📋 Logs ({logs.length})</div>
        <div className="debug-log-content">
          {logs.length > 0 ? logs.map((log, i) => (
            <div 
              key={i} 
              className={`debug-log-item ${
                log.includes('❌') ? 'error' : 
                log.includes('✅') ? 'success' : 
                log.includes('🚀') ? 'info' : ''
              }`}
            >
              {log}
            </div>
          )) : (
            <div className="debug-log-empty">Waiting for logs...</div>
          )}
        </div>
      </div>

      {/* Config details */}
      {(currentTool || resources.length > 0) && (
        <div className="debug-config-panel">
          <div className="debug-config-title">
            📝 Config {currentTool && `• ${currentTool.config.title}`} {resources.length > 0 && `• ${resources.length} resource(s)`}
          </div>
          
          {currentTool && (
            <div className={`debug-tool-info ${resources.length > 0 ? 'has-border' : ''}`}>
              <div className="debug-tool-label">🛠️ Tool Info</div>
              <div className="debug-tool-content">
                <div><strong>Name:</strong> {currentTool.config.title}</div>
                <div><strong>Description:</strong> {currentTool.config.description}</div>
                {Object.keys(currentTool.args).length > 0 && (
                  <div className="debug-tool-args">
                    <div className="debug-tool-args-label">Args:</div>
                    <pre className="debug-tool-args-code">
                      {JSON.stringify(currentTool.args, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Module Federation config */}
      {resources.length > 0 && resources[0]?.moduleFederation && (
        <div className="debug-mf-config">
          <div className="debug-mf-config-title">Module Federation Config:</div>
          {JSON.stringify({
            remoteName: resources[0].moduleFederation.remoteName,
            module: resources[0].moduleFederation.module,
            exportName: resources[0].moduleFederation.exportName
          }, null, 2)}
        </div>
      )}
    </>
  );
}

export function DebugToolbarButton({ 
  showDebugPanel, 
  onToggle 
}: { 
  showDebugPanel: boolean; 
  onToggle: () => void; 
}) {
  return (
    <button
      className={`mf-tool-btn${showDebugPanel ? ' active' : ''}`}
      onClick={onToggle}
      title={showDebugPanel ? 'Close debug panel' : 'Open debug panel'}
    >
      {showDebugPanel ? '🔴' : '🔧'}
    </button>
  );
}
