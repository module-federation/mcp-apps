# Manual Setup Flow

When no Module Federation config is found, use this interactive flow to create configuration from scratch.

## Pre-requisites Check

**Ask**:
1. "Is this a Module Federation remote project?"
   - If **No**: Exit (not applicable)
   - If **Yes**: Continue

2. "Do you have a running dev server for this remote?"
   - If **No**: "Please start dev server first (e.g., `npm run dev`)"
   - If **Yes**: Note the URL

## Step 1: Gather Remote Information

**Prompt for**:

### Remote Name
```
Q: "What is the name of this remote?"
Example: "my_components", "ui_library", "data_widgets"

Rules:
- Use snake_case or kebab-case
- Must be unique across your app
- Should match package.json name if possible
```

### Remote Version
```
Q: "What version is this remote?"
Example: "1.0.0", "0.1.0"

Rules:
- Must follow semver format (major.minor.patch)
- Default to "0.1.0" for new projects
```

### Remote URL
```
Q: "What is the base URL for this remote?"
Example: "http://localhost:5001/", "https://cdn.example.com/remotes/ui/"

Rules:
- Must include protocol (http:// or https://)
- Must end with trailing slash (/)
- Must be accessible from consumer app
```

**Validation**:
```javascript
function validateRemoteInfo(info) {
  if (!info.name.match(/^[a-z0-9_-]+$/)) {
    return 'Invalid name format. Use snake_case or kebab-case.';
  }
  
  if (!info.version.match(/^\d+\.\d+\.\d+$/)) {
    return 'Invalid version. Use semver format (e.g., 1.0.0).';
  }
  
  if (!info.url.match(/^https?:\/\/.+\/$/)) {
    return 'Invalid URL. Must start with http:// or https:// and end with /';
  }
  
  return null; // Valid
}
```

## Step 2: Gather Exposed Modules

**Prompt**:
```
"What modules does this remote expose?"
Provide as list of exposes entries:

Format: <key> -> <path>
Example:
- . -> ./src/App.tsx
- ./Button -> ./src/components/Button.tsx
- ./Input -> ./src/components/Input.tsx
```

**Interactive Flow**:
```
1. "Enter expose key (e.g., './Button' or '.' for root, or 'done' to finish):"
   → User: "./Button"

2. "Enter file path for './Button':"
   → User: "./src/components/Button.tsx"

3. "Added: './Button' -> './src/components/Button.tsx'"
   Repeat from step 1 until user types "done"
```

**Alternative: Parse from Code**
```
"Would you like me to scan your project for exportable components?"
- Scan src/ for .tsx/.jsx files
- Suggest common patterns:
  - './src/App.tsx' → './App'
  - './src/components/Button.tsx' → './Button'
```

## Step 3: Generate Tools

For each expose entry, generate tool config:

```javascript
function generateTool(exposeKey, remoteName) {
  // Extract module name
  let moduleName = exposeKey === '.' ? remoteName : exposeKey.replace('./', '');
  
  // Convert to snake_case
  const toolName = moduleName
    .replace(/([A-Z])/g, '_$1')
    .toLowerCase()
    .replace(/^_/, '');
  
  // Generate title (Title Case)
  const title = toolName
    .split('_')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
  
  return {
    name: toolName,
    title: title,
    description: `A ${moduleName} component from ${remoteName}`,
    remote: remoteName,
    module: exposeKey,
    exportName: 'default'
  };
}
```

## Step 4: Create Config File

**Prompt**:
```
"Where should I create the mcp_apps.json file?"
Default: Current directory

Options:
1. Current directory (./mcp_apps.json)
2. Project root (detected from package.json location)
3. Custom path (user specifies)
```

**Generate File**:
```json
{
  "$schema": "../path/to/mcp_apps.schema.json",
  "remotes": [
    {
      "name": "<user_provided_name>",
      "version": "<user_provided_version>",
      "url": "<user_provided_url>"
    }
  ],
  "tools": [
    // Generated from exposes
  ]
}
```

## Step 5: Validation

After creation, validate the config:

```bash
# If MCP CLI available
mcp-apps validate mcp_apps.json

# Otherwise, manual checks
- ✅ File exists
- ✅ Valid JSON syntax
- ✅ All required fields present
- ✅ Remote name matches in tools
- ✅ URLs are accessible (optional test)
```

**Validation Output**:
```
✅ Config created successfully!
✅ 1 remote defined: my_components
✅ 3 tools generated: button, input, app_component
✅ Schema reference added

Next steps:
1. Start your dev server: npm run dev
2. Test in consumer app
3. Adjust URLs if needed
```

## Common Scenarios

### Scenario 1: Simple UI Library

```
Remote: ui_components
Version: 1.0.0
URL: http://localhost:4000/
Exposes:
- ./Button
- ./Input
- ./Select

→ Generates 3 tools: button, input, select
```

### Scenario 2: Monorepo Package

```
Remote: @company/design-system
Version: 2.1.0
URL: https://cdn.company.com/design-system/
Exposes:
- . (root export)

→ Generates 1 tool: design_system_component
```

### Scenario 3: Mixed Exports

```
Remote: shared_modules
Version: 0.5.0
URL: http://localhost:3001/
Exposes:
- ./App (component)
- ./store (Redux store)
- ./utils (utility functions)

→ Generates 3 tools: app, store, utils
Note: All exposes become tools (not just components)
```

## Error Handling

### Invalid Input

```
Q: "Remote name?"
A: "My Components"  // Contains spaces

→ Error: "Invalid name format. Use snake_case: 'my_components'"
→ Retry prompt
```

### Missing Information

```
If user skips required field:
→ Error: "This field is required. Please provide a value."
→ Re-prompt
```

### File Already Exists

```
If mcp_apps.json exists:
→ Prompt: "File exists. Overwrite? (y/n)"
  - y: Backup old file → Create new
  - n: Suggest different path
```

## Tips for Users

**Best Practices**:
1. Keep remote names descriptive and unique
2. Use consistent versioning (semver)
3. Ensure dev server is running before testing
4. Test with simple component first
5. Add schema reference for IDE support

**Common Mistakes to Avoid**:
- ❌ Forgetting trailing slash in URL
- ❌ Using camelCase for tool names
- ❌ Incorrect remote reference in tools
- ❌ Missing protocol in URL

**Next Steps After Setup**:
1. Verify dev server is running
2. Test config in consumer app
3. Adjust configurations as needed
4. Consider adding props for components
