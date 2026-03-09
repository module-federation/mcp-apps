export interface AppData {
  name: string;
  url: string;
  remotes?: Record<string, string>;
  exposedComponents?: string[];
}

export interface ResourceData {
  name: string;
  uri: string;
  mimeType: string;
  moduleFederation?: {
    remoteName: string;
    remoteEntry: string;
    module: string;
    exportName: string;
    snapshotUrl?: string;
    /** 'vmok' = legacy snapshot mode (vmok-manifest + snapshot.json), 'mf' = standard MF manifest (mf-manifest.json) */
    manifestType: 'vmok' | 'mf';
  };
}

export interface ToolData {
  tool: string;
  config: {
    name?: string;
    title?: string;
    description?: string;
    resource?: any;
  };
  args: Record<string, any>;
}
