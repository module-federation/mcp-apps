import React from 'react';
import type { ModuleFederationConfig } from '../loaders/mf-loader.js';
import { useRemoteComponent } from '../hooks/useRemoteComponent.js';
import { ErrorBoundary } from './error-boundary.js';
import type { App } from '@modelcontextprotocol/ext-apps';
import '../styles/component-renderer.css';

export interface RemoteComponentContainerProps {
  /**
   * Module Federation configuration for loading the remote component.
   * Must include remoteName, remoteEntry, module, exportName, and manifestType.
   */
  config: ModuleFederationConfig;

  /**
   * Props to pass to the loaded remote component.
   * These are spread as component props: <RemoteComponent {...args} />
   */
  args?: Record<string, any>;

  /**
   * Optional MCP App instance to pass as `mcpApp` prop to the component.
   * This allows the remote component to communicate with the MCP host.
   */
  mcpApp?: App | null;

  /**
   * Optional callback to log messages during loading.
   */
  onLog?: (msg: string) => void;

  /**
   * Custom loading UI. Defaults to a spinner + "Loading..." text.
   */
  loadingFallback?: React.ReactNode;

  /**
   * Custom error UI. Defaults to error details with stack trace.
   * Receives error message as string.
   */
  errorFallback?: (error: string) => React.ReactNode;

  /**
   * Custom wrapper class name for the component container.
   */
  className?: string;

  /**
   * Optional dependency array to trigger reload.
   * If provided, component reloads when deps change.
   */
  deps?: React.DependencyList;
}

/**
 * Container component for rendering remote Module Federation components.
 *
 * This is the easiest way to load and render a remote component.
 * It handles loading, error states, and passes props/mcpApp automatically.
 *
 * @example
 * ```tsx
 * <MFProvider>
 *   <RemoteComponentContainer
 *     config={{
 *       remoteName: 'my_remote',
 *       remoteEntry: 'http://localhost:8080/mf-manifest.json',
 *       module: './MyComponent',
 *       exportName: 'default',
 *       manifestType: 'mf',
 *     }}
 *     args={{ title: 'Hello' }}
 *     mcpApp={app}
 *     onLog={console.log}
 *   />
 * </MFProvider>
 * ```
 */
export function RemoteComponentContainer({
  config,
  args = {},
  mcpApp = null,
  onLog,
  loadingFallback,
  errorFallback,
  className,
  deps,
}: RemoteComponentContainerProps) {
  const { component: RemoteComponent, isLoading, error } = useRemoteComponent({
    config,
    onLog,
    deps,
  });

  return (
    <div className={className || 'mf-content'}>
      <div className="mf-component-container">
        {/* Loading State */}
        {isLoading && (
          loadingFallback ?? (
            <div className="mf-loading-wrapper">
              <div className="loading-spinner"></div>
              <div className="mf-loading-text">Loading...</div>
            </div>
          )
        )}

        {/* Error State */}
        {!isLoading && error && (
          errorFallback ? (
            errorFallback(error)
          ) : (
            <div className="component-error-container">
              <div className="component-error-icon">❌</div>
              <div className="component-error-title">Component Load Error</div>
              <div className="component-error-message">{error}</div>
            </div>
          )
        )}

        {/* Loaded Component */}
        {!isLoading && !error && RemoteComponent && (
          <div className="mf-component-wrapper">
            <div data-component-container className="mf-component-wrapper">
              <ErrorBoundary>
                <RemoteComponent {...args} mcpApp={mcpApp} />
              </ErrorBoundary>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
