import React, { useRef } from 'react';
import { MFContext, type MFContextType } from './MFContext.js';

interface MFProviderProps {
  children: React.ReactNode;
}

/**
 * Provider component for global Module Federation caching.
 * 
 * Wraps your application to share MF instance cache and snapshot cache
 * across all <RemoteComponentContainer> components. This prevents:
 * - React Hook conflicts ("Invalid hook call") when reusing the same remote
 * - Duplicate MF instance creation
 * - Unnecessary snapshot fetches
 *
 * Usage:
 * ```tsx
 * <MFProvider>
 *   <App />
 * </MFProvider>
 * ```
 */
export function MFProvider({ children }: MFProviderProps) {
  const mfInstanceRef = useRef<any>(null);
  const snapshotCacheRef = useRef<Map<string, any>>(new Map());
  const lastRemoteNameRef = useRef<string>('');

  const contextValue: MFContextType = {
    mfInstanceRef,
    snapshotCacheRef,
    lastRemoteNameRef,
  };

  return (
    <MFContext.Provider value={contextValue}>
      {children}
    </MFContext.Provider>
  );
}
