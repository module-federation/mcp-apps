# 04 · mcp_apps.json Config Reference

`mcp_apps.json` is the central configuration file. It describes your MF remote modules and the MCP tools to register.

## Full Example

```json
{
  "$schema": "./mcp_apps.schema.json",
  "version": "1.0.0",
  "remotes": [
    {
      "name": "my_app",
      "version": "1.2.3",
      "baseUrl": "https://cdn.example.com/my-app",
      "locale": "en",
      "manifestType": "mf",
      "csp": {
        "connectDomains": ["https://cdn.example.com", "https://api.example.com"],
        "resourceDomains": ["https://cdn.example.com"],
        "frameDomains": [],
        "baseUriDomains": []
      }
    }
  ],
  "tools": [
    {
      "name": "my_tool",
      "title": "My Tool",
      "description": "Tool description — Claude reads this to decide when to call it",
      "inputSchema": {
        "type": "object",
        "properties": {
          "param1": { "type": "string", "description": "Parameter description" }
        },
        "required": ["param1"]
      },
      "remote": "my_app",
      "module": "./MyComponent",
      "exportName": "default",
      "visibility": ["model", "app"]
    }
  ]
}
```

---

## `remotes[]` Fields

### `name` · string · required

Unique identifier for the remote module.

- Open-source MF projects: matches the `name` field in `module-federation.config.ts` — only lowercase letters, digits, and underscores
- npm scoped packages: use the package name, e.g. `@cloud-public/my-package`

```json
"name": "my_app"
"name": "@cloud-public/my-package"
```

---

### `version` · string · required

Version of the remote module.

- `"mf"` type: version has no effect on URL construction — use `"latest"` or any string
- `"vmok"` type: embedded in the URL as `baseUrl/version/locale/vmok-manifest.json`

```json
"version": "latest"       // mf type
"version": "1.0.0"        // vmok type (exact version)
```

---

### `baseUrl` · string · required

CDN base path for the component (without version or locale).

- Must be a full URL (`http://` or `https://`)
- No trailing slash
- Use `http://localhost:<port>` for local development

**URL construction rules:**

| manifestType | Resolved URL |
|---|---|
| `"mf"` | `{baseUrl}/mf-manifest.json` |
| `"vmok"` | `{baseUrl}/{version}/{locale}/vmok-manifest.json` |

```json
"baseUrl": "http://localhost:3001"
"baseUrl": "https://cdn.example.com/my-project"
"baseUrl": "https://unpkg.com/@cloud-public/my-package"
```

---

### `locale` · string · optional, default `"en"`

Language/region identifier.

- `"mf"` type: does not affect the URL, can be omitted
- `"vmok"` type: embedded in the URL path

```json
"locale": "en"
"locale": "zh"
```

---

### `manifestType` · `"mf"` | `"vmok"` · optional, default `"mf"`

Manifest format of the remote module:

| Value | Description | When to use |
|-------|-------------|-------------|
| `"mf"` | Standard Module Federation — produces `mf-manifest.json` | Your own projects, any open-source MF project |
| `"vmok"` | ByteDance-internal vmok format — produces `vmok-manifest.json` + `vmok-snapshot.json` | ByteDance-internal vmok packages |

```json
"manifestType": "mf"     // your own project
```

---

### `csp` · object · required

Content Security Policy config — controls which domains the iframe can access.

> **Important**: every domain must include the full protocol!
> - ✅ `"https://cdn.example.com"`
> - ✅ `"http://localhost:3001"`
> - ❌ `"cdn.example.com"` (no protocol — CSP will ignore it)
> - ❌ `"localhost:3001"` (no protocol — CSP will ignore it)

#### `csp.connectDomains` · string[] · required

Domains the component is allowed to `fetch/XHR` (maps to CSP `connect-src`).

Include:
1. The origin of `baseUrl` (loading manifest and snapshot)
2. All API domains fetched inside the component
3. Any CDN domain referenced by `getPublicPath` in a vmok snapshot (may differ from `baseUrl`)

```json
"connectDomains": [
  "http://localhost:3001",
  "https://api.example.com"
]
```

Wildcards (`*.example.com`) match all subdomains.

#### `csp.resourceDomains` · string[] · required

Domains allowed to serve scripts/resources (maps to CSP `script-src`).

Include:
1. The origin of `baseUrl`
2. The actual CDN hosting JS chunks (may be different from `baseUrl` in vmok setups)

```json
"resourceDomains": [
  "http://localhost:3001",
  "https://cdn.example.com"
]
```

#### `csp.frameDomains` · string[] · optional

Allowed iframe sources (maps to CSP `frame-src`). Rarely needed.

#### `csp.baseUriDomains` · string[] · optional

`base-uri` restriction. Rarely needed.

---

## `tools[]` Fields

### `name` · string · required

Unique tool identifier — exposed to Claude as the MCP tool name.

- Must be `snake_case` (lowercase letters, digits, underscores)
- Must be globally unique within `mcp_apps.json`
- Claude uses this name to decide which tool to call

```json
"name": "show_application_list"
"name": "deploy_wizard_step1"
```

---

### `title` · string · required

Human-readable tool title, shown in Claude's tool list.

```json
"title": "Show Application List"
"title": "Deploy Wizard Step 1: Select App"
```

---

### `description` · string · required

Tool description — **this is the primary signal Claude uses to decide when to call the tool**. Be specific.

Best practices:
- Describe what UI the tool renders
- Explain what the user can do with it
- Describe what happens after interaction (e.g. "after the user confirms, the component automatically triggers step2")
- For tools that should not be called proactively, explicitly state "triggered automatically by XXX — do not call proactively"

```json
"description": "Shows an app list for the user to choose a deployment target. After selection the component automatically triggers deploy_wizard_step2."
```

---

### `inputSchema` · object · optional, default `{}`

JSON Schema for the tool's parameters. Claude uses this schema to determine which arguments to pass.

```json
"inputSchema": {
  "type": "object",
  "properties": {
    "appId": {
      "type": "string",
      "description": "Application ID (required)"
    },
    "env": {
      "type": "string",
      "enum": ["production", "staging", "canary"],
      "default": "production",
      "description": "Deployment environment"
    },
    "count": {
      "type": "number",
      "description": "Number of items to display",
      "default": 10
    }
  },
  "required": ["appId"]
}
```

These parameters are passed directly as props to your component (`<Component appId="..." env="..." />`).

> **Do not declare `mcpApp` in `inputSchema`** — it is injected automatically by the framework.

---

### `visibility` · `("model" | "app")[]` · optional, default `["model", "app"]`

Controls who can see and call the tool.

| Value | Meaning |
|-------|---------|
| `["model", "app"]` | **Default.** Claude Agent can call it; components can also call it via `callServerTool` |
| `["model"]` | Only Claude Agent can call it — not in the component callable list |
| `["app"]` | Only components can call it via `callServerTool` — **not in Claude's tool list** |

**Typical uses**:
- Data-fetching tools (`["app"]`): component-only, prevents the Agent from calling them unexpectedly
- UI tools (`["model", "app"]`): Claude renders them proactively; components can also chain-trigger them
- Wizard intermediate steps (`["model"]`): Agent-only sequential trigger

---

### `remote` · string · required

References which entry in `remotes[]` to use — must match the remote's `name`.

```json
"remote": "my_app"
```

---

### `module` · string · required

The Module Federation `exposes` path — matches the key in `module-federation.config.ts`.

```json
// module-federation.config.ts:
// exposes: { './ApplicationList': './src/components/ApplicationList.tsx' }

"module": "./ApplicationList"

// Root expose:
// exposes: { '.': './src/index.tsx' }
"module": "."
```

---

### `exportName` · string · optional, default `"default"`

The export name to use from the remote module.

```json
// export default MyComponent;  →  "exportName": "default"
// export { MyComponent };      →  "exportName": "MyComponent"
```

---

## Full Example: Local Development

```json
{
  "$schema": "./mcp_apps.schema.json",
  "version": "1.0.0",
  "remotes": [
    {
      "name": "my_app",
      "version": "latest",
      "baseUrl": "http://localhost:3001",
      "locale": "en",
      "manifestType": "mf",
      "csp": {
        "connectDomains": ["http://localhost:3001"],
        "resourceDomains": ["http://localhost:3001"]
      }
    }
  ],
  "tools": [
    {
      "name": "hello_widget",
      "title": "Hello Widget",
      "description": "Renders a greeting component",
      "inputSchema": {
        "type": "object",
        "properties": {
          "name": { "type": "string", "default": "World" }
        }
      },
      "remote": "my_app",
      "module": "./HelloWidget"
    }
  ]
}
```

## Full Example: Production CDN

```json
{
  "$schema": "./mcp_apps.schema.json",
  "version": "1.0.0",
  "remotes": [
    {
      "name": "shop_frontend",
      "version": "2.1.0",
      "baseUrl": "https://cdn.mycompany.com/shop-frontend",
      "locale": "en",
      "manifestType": "mf",
      "csp": {
        "connectDomains": [
          "https://cdn.mycompany.com",
          "https://api.mycompany.com"
        ],
        "resourceDomains": [
          "https://cdn.mycompany.com"
        ]
      }
    }
  ],
  "tools": [
    {
      "name": "product_list",
      "title": "Product List",
      "description": "Renders the product list — user can filter and select items",
      "inputSchema": {
        "type": "object",
        "properties": {
          "category": { "type": "string", "description": "Product category" },
          "page": { "type": "number", "default": 1 }
        }
      },
      "remote": "shop_frontend",
      "module": "./ProductList"
    }
  ]
}
```
