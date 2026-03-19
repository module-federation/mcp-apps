import { useState, useEffect, useCallback, useRef } from 'react';
import type { ModuleFederationConfig } from '../loaders/mf-loader.js';
import { loadRemoteComponent } from '../loaders/mf-loader.js';
import { useMFContext } from '../context/MFContext.js';

export interface UseRemoteComponentOptions {
  config: ModuleFederationConfig;
  onLog?: (msg: string) => void;
  /** Timeout for remote loading in milliseconds (default: 20000) */
  loadTimeoutMs?: number;
  /**
   * Dependency array to trigger reload.
   * If not provided, component loads once on mount.
   * If provided, component reloads when deps change.
   */
  deps?: React.DependencyList;
}

export interface UseRemoteComponentResult {
  /** The loaded React component, or null if still loading/error */
  component: any;
  /** Whether the component is currently loading */
  isLoading: boolean;
  /** Error message if loading failed, or null */
  error: string | null;
  /** Manually trigger a reload of the component */
  reload: () => void;
}

/**
 * Hook to load a remote Module Federation component.
 *
 * Handles:
 * - Loading state management
 * - Error handling
 * - MF instance caching (shared across hook instances via MFProvider)
 * - Snapshot caching (for vmok manifests)
 *
 * @example
 * ```tsx
 * const { component: MyComponent, isLoading, error } = useRemoteComponent({
 *   config: {
 *     remoteName: 'my_remote',
 *     remoteEntry: 'http://localhost:8080/mf-manifest.json',
 *     module: './MyComponent',
 *     exportName: 'default',
 *     manifestType: 'mf',
 *   },
 *   onLog: console.log,
 *   deps: [someExternalDep],
 * });
 *
 * if (isLoading) return <div>Loading...</div>;
 * if (error) return <div>Error: {error}</div>;
 * return <MyComponent {...props} />;
 * ```
 */
export function useRemoteComponent({
  config,
  onLog,
  loadTimeoutMs = 20000,
  deps,
}: UseRemoteComponentOptions): UseRemoteComponentResult {
  const [component, setComponent] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const mfContext = useMFContext();

  const onLogRef = useRef(onLog);

  useEffect(() => {
    onLogRef.current = onLog;
  }, [onLog]);

  const addLog = useCallback(
    (msg: string) => {
      if (onLogRef.current) {
        const timestamp = new Date().toLocaleTimeString();
        onLogRef.current(`[${timestamp}] ${msg}`);
      }
    },
    []
  );

  // Compute effective dependencies
  const effectDeps = deps ?? [];

  // Effect to load the component
  useEffect(() => {
    let isMounted = true;

    const loadComponent = async () => {
      let timeoutId: ReturnType<typeof setTimeout> | null = null;
      try {
        setIsLoading(true);
        setError(null);
        setComponent(null);

        const timeoutPromise = new Promise<never>((_, reject) => {
          timeoutId = setTimeout(() => {
            reject(new Error(`Load timeout after ${loadTimeoutMs}ms: ${config.remoteName}/${config.module}`));
          }, loadTimeoutMs);
        });

        const loadedComponent = await Promise.race([
          loadRemoteComponent({
            config: {
              remoteName: config.remoteName,
              remoteEntry: config.remoteEntry,
              module: config.module,
              exportName: config.exportName,
              snapshotUrl: config.snapshotUrl,
              manifestType: config.manifestType,
            },
            addLog,
            mfInstanceRef: mfContext.mfInstanceRef,
            snapshotCacheRef: mfContext.snapshotCacheRef,
            lastRemoteNameRef: mfContext.lastRemoteNameRef,
          }),
          timeoutPromise,
        ]);

        if (timeoutId) {
          clearTimeout(timeoutId);
        }

        if (isMounted) {
          setComponent(() => loadedComponent);
          setIsLoading(false);
        }
      } catch (err: any) {
        if (timeoutId) {
          clearTimeout(timeoutId);
        }
        if (isMounted) {
          const errorMsg = err?.message || String(err);
          addLog(`❌ Load failed: ${errorMsg}`);
          setError(errorMsg);
          setIsLoading(false);
        }
      }
    };

    loadComponent();

    return () => {
      isMounted = false;
    };
  }, [
    config.remoteName,
    config.remoteEntry,
    config.module,
    config.exportName,
    config.snapshotUrl,
    config.manifestType,
    addLog,
    mfContext,
    reloadKey,
    ...effectDeps,
  ]);

  const reload = useCallback(() => {
    setReloadKey((k) => k + 1);
  }, []);

  return { component, isLoading, error, reload };
}
