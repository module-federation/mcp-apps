/**
 * Configuration loader and types
 */

export interface ModuleFederationConfig {
  remoteName: string;
  remoteEntry: string;
  module: string;
  exportName?: string;
}

export interface CSPConfig {
  connectDomains?: string[];
  resourceDomains?: string[];
}

export interface ResourceConfig {
  name: string;
  uri: string;
  mimeType?: string;
  moduleFederation: ModuleFederationConfig;
  csp?: CSPConfig;
}

export interface ToolConfig {
  name: string;
  title: string;
  description: string;
  inputSchema?: Record<string, unknown>;
  ui: {
    resourceUri: string;
    visibility?: string[];
  };
}

export interface McpAppsConfig {
  tools: ToolConfig[];
  resources: ResourceConfig[];
}

/**
 * Load and validate MCP Apps configuration
 */
export async function loadConfig(configPath: string): Promise<McpAppsConfig> {
  let configData: string;

  if (configPath.startsWith('http://') || configPath.startsWith('https://')) {
    // Load from URL
    const response = await fetch(configPath);
    if (!response.ok) {
      throw new Error(`Failed to fetch config from ${configPath}: ${response.statusText}`);
    }
    configData = await response.text();
  } else {
    // Load from file
    const { readFile } = await import('fs/promises');
    configData = await readFile(configPath, 'utf-8');
  }

  const config = JSON.parse(configData) as McpAppsConfig;

  // Validate basic structure
  if (!config.tools || !Array.isArray(config.tools)) {
    throw new Error('Invalid config: "tools" must be an array');
  }

  if (!config.resources || !Array.isArray(config.resources)) {
    throw new Error('Invalid config: "resources" must be an array');
  }

  // Validate that all tool resourceUris have corresponding resources
  const resourceUris = new Set(config.resources.map(r => r.uri));
  for (const tool of config.tools) {
    if (!resourceUris.has(tool.ui.resourceUri)) {
      throw new Error(
        `Tool "${tool.name}" references resource "${tool.ui.resourceUri}" which doesn't exist`
      );
    }
  }

  return config;
}

/**
 * Get resource by URI
 */
export function getResourceByUri(
  config: McpAppsConfig,
  uri: string
): ResourceConfig | undefined {
  return config.resources.find(r => r.uri === uri);
}
