# Skill: Generate MCP Apps Config

Generate or update `mcp_apps.json` configuration file for Module Federation projects.

**When to use this skill**: When you need to generate `mcp_apps.json`, create MCP Apps config, add a module to `mcp_apps.json`, add exposed module, register new component, update MCP config, configure MCP Apps, or set up Module Federation components as MCP tools.

---

## Overview

This skill handles two scenarios:

**A) Create new `mcp_apps.json`** — when no config exists yet
1. **Auto-detect** Module Federation config files
2. **Extract** package name and exposed modules
3. **Generate** complete `mcp_apps.json` with remotes and tools
4. **Validate** configuration correctness
5. **Enable** MF components as interactive MCP tools

**B) Add module to existing `mcp_apps.json`** — when config already exists
1. **Read** current `mcp_apps.json`
2. **Identify** the new module to add (from exposes or user input)
3. **Append** new tool entry, keeping existing tools intact
4. **Validate** no duplicate tool names

## Workflow Checklist

Copy and track progress:

- [ ] **Step 0**: Detect scenario ⚠️ REQUIRED
  - [ ] 0.1 Check if `mcp_apps.json` already exists
  - [ ] 0.2 If exists → go to **Add Module Flow** (Step 0A)
  - [ ] 0.3 If not exists → go to **Full Generation Flow** (Step 1)

### Step 0A: Add Module Flow (mcp_apps.json already exists)

1. **Read existing config**: Load and parse current `mcp_apps.json`
2. **Identify new module**: Ask user which exposed module to add, OR detect from MF config which modules are NOT yet in tools
3. **Generate tool entry**:
   - Follow naming rules from Step 3
   - `remote` must reference an existing remote name from the config
   - If the remote doesn't exist yet, add it to remotes first
4. **Append to tools array**: Add new tool without modifying existing ones
5. **Check for duplicates**: Ensure tool `name` is unique
6. **Write back**: Update `mcp_apps.json` in place
7. **Confirm**: Report what was added

**Example**:
```
User: "Add CommTestWidget to mcp_apps.json"
→ Read mcp_apps.json → has remote "demo_provider", 1 existing tool
→ Module: ./CommTestWidget → tool name: comm_test_widget
→ remote: "demo_provider" (already exists in remotes ✓)
→ Append tool entry
→ ✅ Added comm_test_widget to mcp_apps.json
```

- [ ] **Step 1**: Detect MF Project
  - [ ] 1.1 Check for config files ⚠️ REQUIRED
  - [ ] 1.2 Identify config type (TS/JS)
- [ ] **Step 2**: Parse configuration
  - [ ] 2.1 Extract package name
  - [ ] 2.2 Extract exposes map
  - [ ] 2.3 Validate extracted data ⚠️ REQUIRED
- [ ] **Step 3**: Generate tools
  - [ ] 3.1 Convert exposes to tools
  - [ ] 3.2 Apply naming conventions
  - [ ] 3.3 Generate descriptions
- [ ] **Step 4**: Collect CDN info ⚠️ REQUIRED
  - [ ] 4.1 Ask for base URL
  - [ ] 4.2 Ask for version
  - [ ] 4.3 Ask for locale (default: en)
- [ ] **Step 5**: Create config
  - [ ] 5.1 Copy schema file ⚠️ REQUIRED
  - [ ] 5.2 Generate mcp_apps.json with remotes and tools
  - [ ] 5.3 Validate generated file
- [ ] **Step 6**: Validate output
  - [ ] 6.1 Check JSON syntax
  - [ ] 6.2 Verify schema compliance
  - [ ] 6.3 Confirm tool count matches exposes

## Step 1: Detect MF Project

### Check for Config Files

Look for (in order):
1. `module-federation.config.ts` (standard MF)
2. `rspack.config.js` (Rspack with MF plugin)
3. `webpack.config.js` (Webpack with MF plugin)

**Command**:
```bash
for file in module-federation.config.ts rspack.config.js webpack.config.js; do
  [ -f "$file" ] && echo "FOUND: $file" && break
done
```

**Edge Cases**:
- **No config found**: Skip to Step 4 (manual setup)
- **Multiple configs**: Use first match, warn user
- **Config in subdirectory**: Search with `find . -name "module-federation.config.ts" -o -name "rspack.config.js" -o -name "webpack.config.js"`

## Step 2: Parse Configuration

Load `references/config-parsing.md` for detailed parsing logic.

**Quick check**:
```bash
# For TS config
grep -E "name:|exposes:" module-federation.config.ts

# For JS config  
grep -E "name:|exposes:" rspack.config.js
```

**Ask yourself**:
- Does the config export a default object or function?
- Is `name` a string literal or variable reference?
- Is `exposes` an object literal or computed?

**Validation**:
- ✅ `name` must be non-empty string
- ✅ `exposes` must be object with at least one key
- ❌ If parsing fails, fall back to manual input

## Step 3: Generate Tools

Load `references/tool-generation.md` for naming rules.

**Core transformation**:
```
exposes key → tool name → display name

Examples:
'.' → 'provider_component' → 'Provider Component'
'./Button' → 'button' → 'Button'
'./UserProfile' → 'user_profile' → 'User Profile'
```

**Naming rules**:
1. Remove `./` prefix
2. Convert PascalCase to snake_case
3. Special case: `.` → `{packageName}_component`
4. Title Case for display name

## Step 4: Collect CDN Info

**Required questions**:

1. **Base URL** ⚠️ REQUIRED
   ```
   "Enter CDN base URL (without version/locale):"
   Example: https://unpkg.com/@scope/package
   Example: http://localhost:8080
   ```

2. **Version** (optional, default: "latest")
   ```
   "Enter package version:"
   Default: latest
   ```

3. **Locale** (optional, default: "en")
   ```
   "Enter locale (en/cn/zh):"
   Default: en
   ```

**Validation**:
```bash
# Validate URL format
echo "$baseUrl" | grep -E "^https?://"
```

## Step 5: Create Configuration

**5.1: Copy schema file** ⚠️ REQUIRED
Copy `mcp_apps.schema.json` from this skill's directory to the project root.

**5.2: Generate mcp_apps.json**

**CSP domain extraction rules**:
- Start with the `baseUrl` origin (e.g., `https://cdn.example.com`)
- Always include the protocol in every domain entry — CSP requires full origins, bare hostnames like `localhost:3001` are ignored by browsers.
  - Local dev servers: use `http://localhost:<port>` (e.g., `"http://localhost:3001"`)
  - Remote CDNs: use `https://<domain>` (e.g., `"https://cdn.example.com"`)
  - Protocol-relative `//` URLs are not valid in CSP directives.

```json
{
  "$schema": "./mcp_apps.schema.json",
  "remotes": [{
    "name": "<from MF config>",
    "version": "<user input>",
    "baseUrl": "<user input>",
    "locale": "<user input or 'en'>",
    "csp": {
      "connectDomains": ["<origin from baseUrl>"],
      "resourceDomains": ["<origin from baseUrl>"]
    }
  }],
  "tools": [{
    "name": "<tool_name>",
    "title": "<Tool Title>",
    "description": "<description>",
    "inputSchema": {
      "type": "object",
      "properties": {},
      "required": []
    },
    "remote": "<remote_name>",
    "module": "<module_path>",
    "exportName": "default"
  }]
}
```

**inputSchema Generation Rules**:
- Default: Use empty object `{ "type": "object", "properties": {} }`
- If component has known props, add them as JSON Schema properties

Load `references/config-structure.md` for full schema details.

## Step 6: Validate Output

**Pre-delivery checklist**:

- [ ] Schema file copied to project root (mcp_apps.schema.json)
- [ ] Configuration file generated (mcp_apps.json)
- [ ] JSON syntax valid (`node -e "require('fs'); JSON.parse(require('fs').readFileSync('mcp_apps.json'))"`)
- [ ] `$schema` field present and points to `./mcp_apps.schema.json`
- [ ] All required fields in remotes (name, version, baseUrl, csp)
- [ ] All required fields in tools (name, title, description, inputSchema, remote, module)
- [ ] Tool count = exposes count
- [ ] No duplicate tool names
- [ ] CSP domains extracted from baseUrl
- [ ] `remote` field in tools matches `name` in remotes

## Output Format

**Success**:
```markdown
✅ Configuration created: mcp_apps.json

📦 Package: <name>
🔧 Tools generated: <count>

Tools:
- <tool_name> (<module>)
- ...

Next steps:
1. Review mcp_apps.json
2. Add to Claude Desktop config
3. Restart Claude Desktop
```

**Failure - No MF project detected**:
```markdown
ℹ️ No Module Federation config found

Manual setup required. I'll guide you through:
1. Package name
2. Exposed components
3. CDN information
```

## Manual Setup Flow

If no MF config detected, load `references/manual-setup.md` and collect:

1. Package name (e.g., `@scope/package`)
2. Exposed modules (list with user)
3. CDN base URL
4. Version and locale

Then proceed to Step 5 (Create Configuration).

## Common Issues

Load `references/troubleshooting.md` when needed.

**Quick fixes**:
- **Parse error**: Config uses dynamic imports → ask user for info
- **Empty exposes**: Config computed at runtime → manual input
- **Invalid baseUrl**: Must start with `http://` or `https://`

## References

- `references/config-parsing.md` - Detailed parsing logic for TS/JS
- `references/tool-generation.md` - Naming conventions and examples
- `references/config-structure.md` - Complete schema and examples
- `references/manual-setup.md` - Step-by-step manual configuration
- `references/troubleshooting.md` - Common issues and solutions

## Examples

**Auto-detected MF project**:
```
User: "Generate mcp_apps.json for my project"
→ Detect module-federation.config.ts ✓
→ Parse name: demo_provider, exposes: {'.': '...'}
→ Generate tool: provider_component
→ Ask for CDN: http://localhost:8080
→ Create mcp_apps.json ✓
```

**Manual setup (no config)**:
```
User: "Setup mcp_apps.json"
→ No MF config found
→ Ask: package name? @myapp/components
→ Ask: exposed modules? Button, Card, Modal
→ Ask: CDN URL? https://cdn.example.com
→ Generate config with 3 tools ✓
```
