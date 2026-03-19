/**
 * Module Federation Renderer API
 *
 * Public entry for MF module developers to load and render remote components.
 *
 * @example
 * import { MFProvider, RemoteComponentContainer } from '@module-federation/mcp-apps/renderer';
 */

// Context & Provider
export { MFProvider } from './context/MFProvider.js';
export { MFContext, useMFContext, type MFContextType } from './context/MFContext.js';

// Hook
export { useRemoteComponent, type UseRemoteComponentOptions, type UseRemoteComponentResult } from './hooks/useRemoteComponent.js';

// Components
export { RemoteComponentContainer, type RemoteComponentContainerProps } from './components/remote-component-container.js';

// Re-export loader types so developers can understand the config structure
export type { ModuleFederationConfig, LoadRemoteOptions } from './loaders/mf-loader.js';
