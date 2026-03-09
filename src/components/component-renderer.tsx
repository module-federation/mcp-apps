import { ErrorBoundary } from './error-boundary.js';
import type { ToolData } from '../utils/types.js';
import type { App } from '@modelcontextprotocol/ext-apps';
import '../styles/component-renderer.css';

interface ComponentRendererProps {
  isLoadingMF: boolean;
  mfError: string | null;
  RemoteComponent: any;
  currentTool: ToolData | null;
  addLog: (msg: string) => void;
  app: App | null;
}

export function ComponentRenderer({ 
  isLoadingMF, 
  mfError, 
  RemoteComponent, 
  currentTool,
  addLog,
  app,
}: ComponentRendererProps) {
  return (
    <div className="mf-content">
      <div className="mf-component-container">
        {isLoadingMF && (
          <div className="mf-loading-wrapper">
            <div className="loading-spinner"></div>
            <div className="mf-loading-text">Loading...</div>
          </div>
        )}
        
        {!isLoadingMF && !mfError && RemoteComponent && (() => {
          console.log(`🎨 [render] Preparing to render component`, {
            RemoteComponent: !!RemoteComponent,
            componentType: typeof RemoteComponent,
            isLoadingMF,
            mfError,
            args: currentTool?.args
          });
          
          try {
            return (
              <div className="mf-component-wrapper">
                <div data-component-container className="mf-component-wrapper">
                  <ErrorBoundary>
                    <RemoteComponent 
                      {...(currentTool?.args || {})} 
                      mcpApp={app}
                    />
                  </ErrorBoundary>
                </div>
              </div>
            );
          } catch (outerError: any) {
            console.error(`❌ [render] Outer error:`, outerError);
            addLog(`❌ Component render error: ${outerError.message}`);
            return (
              <div className="component-error-container">
                <div className="component-error-icon">❌</div>
                <div className="component-error-title">Component Load Error</div>
                <div className="component-error-message">
                  {outerError.message || String(outerError)}
                </div>
                {outerError.stack && (
                  <details className="component-error-stack">
                    <summary className="component-error-stack-summary">View full stack trace</summary>
                    <pre className="component-error-stack-pre">
                      {outerError.stack}
                    </pre>
                  </details>
                )}
              </div>
            );
          }
        })()}
      </div>
    </div>
  );
}
