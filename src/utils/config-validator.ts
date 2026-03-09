/**
 * Configuration validator for mcp_apps.json
 * Ensures configuration is valid before server starts
 */

import { z } from 'zod/v4';

/**
 * CSP domain entries must include a full protocol prefix so the browser
 * actually honours them. A bare hostname like "localhost:3001" is silently
 * ignored by the browser's CSP engine, causing blank component loads.
 *
 * Allowed prefixes:
 *   - https://   e.g. "https://cdn.example.com"
 *   - http://    e.g. "http://localhost:3001"
 *   - *.          wildcard subdomain, e.g. "*.example.com" (still needs protocol in real use,
 *                 but is allowed here for schema notation)
 */
const CspDomainSchema = z.string().refine(
  (d) => d.startsWith('https://') || d.startsWith('http://') || d.startsWith('*.'),
  { message: 'CSP domain must start with "https://", "http://", or "*." — bare hostnames like "localhost:3001" are silently ignored by the browser' }
);

// Remote configuration schema
const RemoteConfigSchema = z.object({
  name: z.string().min(1, 'Remote name cannot be empty'),
  version: z.string().optional(),
  baseUrl: z.string().url('Invalid base URL format'),
  locale: z.string().optional().default('en'),
  /** 'vmok' = legacy snapshot manifest, 'mf' = standard MF manifest (mf-manifest.json). Default: 'mf' */
  manifestType: z.enum(['vmok', 'mf']).optional().default('mf'),
  csp: z.object({
    connectDomains: z.array(CspDomainSchema).min(1, 'At least one connect domain required'),
    resourceDomains: z.array(CspDomainSchema).min(1, 'At least one resource domain required'),
    frameDomains: z.array(CspDomainSchema).optional(),
    baseUriDomains: z.array(CspDomainSchema).optional(),
  }),
}).refine(
  (remote) => {
    // version is required only for vmok remotes (embedded in the URL path)
    if (remote.manifestType === 'vmok' && !remote.version) return false;
    return true;
  },
  { message: 'version is required when manifestType is "vmok"', path: ['version'] }
);

// Tool configuration schema
const ToolConfigSchema = z.object({
  name: z.string()
    .min(1, 'Tool name cannot be empty')
    .regex(/^[a-z][a-z0-9_]*$/, 'Tool name must be snake_case (lowercase letters, numbers, underscores)'),
  title: z.string().min(1, 'Tool title cannot be empty'),
  description: z.string().min(1, 'Tool description cannot be empty'),
  inputSchema: z.any().optional().default({}),
  remote: z.string().min(1, 'Remote reference cannot be empty'),
  module: z.string().min(1, 'Module path cannot be empty'),
  exportName: z.string().optional().default('default'),
  /**
   * Who can call this tool. Default: ["model", "app"]
   * - "model": Tool is visible to and callable by the LLM agent
   * - "app":   Tool is callable by the MCP App (iframe) only — hidden from LLM
   */
  visibility: z.array(z.enum(['model', 'app'])).optional().default(['model', 'app']),
});

// Main configuration schema
export const McpAppsConfigSchema = z.object({
  version: z.string().optional(),
  remotes: z.array(RemoteConfigSchema)
    .min(1, 'At least one remote required'),
  tools: z.array(ToolConfigSchema)
    .min(1, 'At least one tool required'),
}).refine(
  (config) => {
    // Validate that all tool remotes reference existing remotes
    const remoteNames = new Set(config.remotes.map(r => r.name));
    return config.tools.every(t => remoteNames.has(t.remote));
  },
  {
    message: 'All tools must reference existing remotes',
    path: ['tools'],
  }
).refine(
  (config) => {
    // Validate that remote names are unique
    const names = config.remotes.map(r => r.name);
    return names.length === new Set(names).size;
  },
  {
    message: 'Remote names must be unique',
    path: ['remotes'],
  }
).refine(
  (config) => {
    // Validate that tool names are unique
    const names = config.tools.map(t => t.name);
    return names.length === new Set(names).size;
  },
  {
    message: 'Tool names must be unique',
    path: ['tools'],
  }
);

export interface ValidationError {
  path: string;
  message: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

/**
 * Validate configuration against schema
 */
export function validateConfig(config: any): ValidationResult {
  const result = McpAppsConfigSchema.safeParse(config);
  
  if (result.success) {
    return { valid: true, errors: [] };
  }
  
  const errors: ValidationError[] = result.error.issues.map((err: any) => ({
    path: err.path.join('.'),
    message: err.message,
  }));
  
  return { valid: false, errors };
}

/**
 * Type guard for validated config
 */
export type McpAppsConfig = z.infer<typeof McpAppsConfigSchema>;
