# Config Structure

## Complete Schema

```json
{
  "$schema": "../path/to/mcp_apps.schema.json",
  "remotes": [
    {
      "name": "string",
      "version": "string",
      "url": "string"
    }
  ],
  "tools": [
    {
      "name": "string",
      "title": "string",
      "description": "string",
      "remote": "string",
      "module": "string",
      "exportName": "string",
      "props": {
        "key": "value"
      }
    }
  ]
}
```

## Field Specifications

### Root Level

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `$schema` | string | Recommended | Path to schema file for IDE hints |
| `remotes` | array | ✅ Yes | Remote module definitions |
| `tools` | array | ✅ Yes | Tool definitions |

### Remote Object

| Field | Type | Required | Description | Example |
|-------|------|----------|-------------|---------|
| `name` | string | ✅ Yes | Remote module identifier | `"demo_provider"` |
| `version` | string | ✅ Yes | Semantic version | `"0.1.0"` |
| `url` | string | ✅ Yes | Base URL for remoteEntry | `"http://localhost:5001/"` |

**URL Rules**:
- Must end with `/`
- Protocol required (`http://` or `https://`)
- Will load `{url}mf-manifest.json`
- remoteEntry path from manifest

### Tool Object

| Field | Type | Required | Description | Example |
|-------|------|----------|-------------|---------|
| `name` | string | ✅ Yes | Unique snake_case identifier | `"user_profile"` |
| `title` | string | ✅ Yes | Display name (Title Case) | `"User Profile"` |
| `description` | string | ✅ Yes | Human-readable description | `"A UserProfile component from demo"` |
| `remote` | string | ✅ Yes | References remote.name | `"demo_provider"` |
| `module` | string | ✅ Yes | Module path (matches exposes) | `"./UserProfile"` |
| `exportName` | string | No | Named export (default: "default") | `"UserProfile"` |
| `props` | object | No | Default props for component | `{"theme": "dark"}` |

## Example Configurations

### Single Remote, Single Tool

```json
{
  "$schema": "../mcp_apps.schema.json",
  "remotes": [
    {
      "name": "components",
      "version": "1.0.0",
      "url": "http://localhost:3000/"
    }
  ],
  "tools": [
    {
      "name": "button",
      "title": "Button",
      "description": "A Button component from components",
      "remote": "components",
      "module": "./Button",
      "exportName": "default"
    }
  ]
}
```

### Multiple Remotes, Multiple Tools

```json
{
  "$schema": "../mcp_apps.schema.json",
  "remotes": [
    {
      "name": "ui_library",
      "version": "2.1.0",
      "url": "http://localhost:4000/"
    },
    {
      "name": "data_widgets",
      "version": "1.5.3",
      "url": "http://localhost:4001/"
    }
  ],
  "tools": [
    {
      "name": "text_input",
      "title": "Text Input",
      "description": "A TextInput component from ui_library",
      "remote": "ui_library",
      "module": "./TextInput",
      "exportName": "default"
    },
    {
      "name": "data_table",
      "title": "Data Table",
      "description": "A DataTable component from data_widgets",
      "remote": "data_widgets",
      "module": "./DataTable",
      "exportName": "DataTable",
      "props": {
        "pageSize": 20
      }
    }
  ]
}
```

### With Props

```json
{
  "tools": [
    {
      "name": "themed_button",
      "title": "Themed Button",
      "description": "A Button with theme support",
      "remote": "ui",
      "module": "./Button",
      "exportName": "default",
      "props": {
        "theme": "primary",
        "size": "large",
        "variant": "contained"
      }
    }
  ]
}
```

## Validation Rules

### Remote Validation

```javascript
function validateRemote(remote) {
  // ✅ Name format
  if (!/^[a-z0-9_-]+$/i.test(remote.name)) {
    throw new Error('Invalid remote name format');
  }
  
  // ✅ Version format (semver)
  if (!/^\d+\.\d+\.\d+/.test(remote.version)) {
    throw new Error('Invalid version format (expected semver)');
  }
  
  // ✅ URL format
  if (!remote.url.startsWith('http://') && !remote.url.startsWith('https://')) {
    throw new Error('URL must start with http:// or https://');
  }
  
  if (!remote.url.endsWith('/')) {
    console.warn('URL should end with /');
  }
}
```

### Tool Validation

```javascript
function validateTool(tool, remotes) {
  // ✅ Name format (snake_case)
  if (!/^[a-z][a-z0-9_]*$/.test(tool.name)) {
    throw new Error('Tool name must be snake_case');
  }
  
  // ✅ Remote reference
  if (!remotes.find(r => r.name === tool.remote)) {
    throw new Error(`Tool "${tool.name}" references unknown remote "${tool.remote}"`);
  }
  
  // ✅ Module format
  if (!tool.module.startsWith('./') && tool.module !== '.') {
    console.warn('Module should start with "./" or be "."');
  }
  
  // ✅ Props (if present)
  if (tool.props && typeof tool.props !== 'object') {
    throw new Error('Props must be an object');
  }
}
```

### Cross-field Validation

```javascript
function validateConfig(config) {
  // ✅ Unique remote names
  const remoteNames = config.remotes.map(r => r.name);
  if (new Set(remoteNames).size !== remoteNames.length) {
    throw new Error('Duplicate remote names found');
  }
  
  // ✅ Unique tool names
  const toolNames = config.tools.map(t => t.name);
  if (new Set(toolNames).size !== toolNames.length) {
    throw new Error('Duplicate tool names found');
  }
  
  // ✅ All tools reference valid remotes
  for (const tool of config.tools) {
    validateTool(tool, config.remotes);
  }
}
```

## Common Mistakes

### ❌ Missing Trailing Slash

```json
{
  "url": "http://localhost:5001"  // Wrong
}
```

✅ **Fix**: `"url": "http://localhost:5001/"`

### ❌ Camel Case Tool Name

```json
{
  "name": "userProfile"  // Wrong
}
```

✅ **Fix**: `"name": "user_profile"`

### ❌ Wrong Remote Reference

```json
{
  "remotes": [{"name": "ui", ...}],
  "tools": [{"remote": "ui_library", ...}]  // Wrong
}
```

✅ **Fix**: `"remote": "ui"`

### ❌ Invalid Module Path

```json
{
  "module": "Button"  // Wrong
}
```

✅ **Fix**: `"module": "./Button"` or `"module": "."`

## Schema Benefits

With `$schema` field:
- ✅ IDE autocomplete
- ✅ Real-time validation
- ✅ Inline documentation
- ✅ Error detection

**Recommended**: Always include relative path to schema:
```json
{
  "$schema": "../mcp_apps.schema.json"
}
```
