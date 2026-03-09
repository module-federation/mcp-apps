import { createInstance } from '@module-federation/enhanced/runtime';
import * as reactExport from 'react';
import * as reactDOMExport from 'react-dom';
import { fixProtocolRelativeUrl } from './snapshot-loader';
import { setupVmokManifest } from './vmok-loader';

export interface ModuleFederationConfig {
  remoteName: string;
  remoteEntry: string;
  module: string;
  exportName: string;
  snapshotUrl?: string;
  manifestType?: 'mf' | 'vmok';
}

export interface LoadRemoteOptions {
  config: ModuleFederationConfig;
  addLog: (msg: string) => void;
  /** Ref holding the cached MF instance (reused across calls for the same remote) */
  mfInstanceRef: { current: any };
  snapshotCacheRef: { current: Map<string, any> };
  lastRemoteNameRef: { current: string };
}

/**
 * Load a remote Module Federation component.
 *
 * Dispatches to the appropriate manifest loader based on `manifestType`:
 *   - `"mf"` (default): standard MF path — uses mf-manifest.json directly
 *   - `"vmok"`: ByteDance-internal path — handled by vmok-loader.ts
 *
 * Reuses the existing MF instance when the same remote is requested again,
 * preventing React multi-instance errors ("Invalid hook call").
 *
 * @returns The resolved React component (or module export)
 */
export async function loadRemoteComponent({
  config,
  addLog,
  mfInstanceRef,
  snapshotCacheRef,
  lastRemoteNameRef,
}: LoadRemoteOptions): Promise<any> {
  const {
    remoteName,
    remoteEntry: rawRemoteEntry,
    module: modulePath,
    exportName,
    snapshotUrl: configSnapshotUrl,
    manifestType = 'mf',
  } = config;

  // ── Step 1: Manifest-specific setup ──────────────────────────────────────
  let remoteEntry: string;

  if (manifestType === 'vmok') {
    // ByteDance-internal vmok path — see vmok-loader.ts for details.
    // External users will never reach this branch.
    remoteEntry = await setupVmokManifest({
      remoteEntry: rawRemoteEntry,
      snapshotUrl: configSnapshotUrl,
      addLog,
      snapshotCache: snapshotCacheRef.current,
    });
  } else {
    // Standard MF path: mf-manifest.json is used directly as the entry.
    remoteEntry = fixProtocolRelativeUrl(rawRemoteEntry);
    addLog(`📋 Using MF manifest: ${remoteEntry}`);
  }

  // ── Step 2: Create or reuse the MF instance ───────────────────────────────
  // The instance is cached per remote name. Re-creating it on every call
  // would cause React to see two separate instances, triggering
  // "Invalid hook call" errors inside remote components.
  let mf;
  if (mfInstanceRef.current && lastRemoteNameRef.current === remoteName) {
    mf = mfInstanceRef.current;
  } else {
    addLog(`🔧 Creating MF instance (${manifestType})...`);
    mf = createInstance({
      name: 'mcp-host',
      remotes: [{ name: remoteName, entry: remoteEntry }],
      shared: {
        react: {
          version: '^18',
          scope: 'default',
          lib: () => reactExport,
          shareConfig: { singleton: true, requiredVersion: '^18 || ^19' },
        },
        'react-dom': {
          version: '^18',
          scope: 'default',
          lib: () => reactDOMExport,
          shareConfig: { singleton: true, requiredVersion: '^18 || ^19' },
        },
      },
    });
    mfInstanceRef.current = mf;
    lastRemoteNameRef.current = remoteName;
  }

  // ── Step 3: Load the remote module ───────────────────────────────────────
  // Normalize module path:
  //   './Foo'  → 'moduleNameA/Foo'
  //   './'     → 'moduleNameA'        (root expose, trailing slash variant)
  //   '.'      → 'moduleNameA'        (root expose, e.g. exposes: { '.': './src/index' })
  const normalizedPath = modulePath.replace(/^\.\//, '');
  const fullPath = normalizedPath === '' || normalizedPath === '.'
    ? remoteName
    : `${remoteName}/${normalizedPath}`;

  addLog(`📦 Loading remote module: ${fullPath}`);

  let remoteModule;
  try {
    remoteModule = await mf.loadRemote(fullPath);
  } catch (loadErr: any) {
    addLog(`❌ Load failed: ${loadErr.message}`);
    throw loadErr;
  }

  const Component = remoteModule[exportName] || remoteModule.default || remoteModule;

  if (!Component) {
    throw new Error(`Export "${exportName}" not found in remote module`);
  }

  return Component;
}

