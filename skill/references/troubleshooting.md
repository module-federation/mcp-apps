# Troubleshooting Guide

## Common Issues

### Issue 1: Config File Not Found

**Symptoms**:
- "No Module Federation config detected"
- Auto-detection fails

**Diagnosis**:
```bash
# Check for config files
ls -la | grep -E "(module-federation|vmok|rspack|webpack).config"

# Check file extensions
find . -maxdepth 2 -name "*config*" -type f
```

**Solutions**:

1. **Config in different location**:
   ```
   Skill searches in:
   - ./module-federation.config.ts
   - ./vmok.config.ts
   - ./rspack.config.js
   - ./webpack.config.js
   
   If config is elsewhere:
   → Use manual setup flow
   → Or move config to root
   ```

2. **Different filename**:
   ```
   Example: mf.config.ts, federation.config.js
   → Rename to standard name
   → Or use manual setup
   ```

3. **Config embedded in webpack.config.js**:
   ```javascript
   // If ModuleFederationPlugin is in webpack config
   → Skill should detect it
   → If not, check plugin name spelling
   ```

### Issue 2: Failed to Parse Config

**Symptoms**:
- "Could not extract name/exposes"
- Partial data extracted

**Common Causes**:

1. **Dynamic values**:
   ```typescript
   // ❌ Cannot parse
   const name = process.env.APP_NAME;
   export default { name, exposes: {...} };
   
   // ✅ Can parse
   export default { 
     name: 'my_app',
     exposes: {...} 
   };
   ```

   **Solution**: Use static values or manual setup

2. **Function export**:
   ```typescript
   // ❌ Cannot parse
   export default function(env) {
     return { name: env.name, exposes: {...} };
   }
   
   // ✅ Can parse
   export default { name: 'my_app', exposes: {...} };
   ```

   **Solution**: Convert to static export or manual setup

3. **Complex syntax**:
   ```typescript
   // ❌ Hard to parse
   const exposes = {
     ...baseExposes,
     ...additionalExposes
   };
   
   // ✅ Easy to parse
   const exposes = {
     './Button': './src/Button.tsx',
     './Input': './src/Input.tsx'
   };
   ```

   **Solution**: Flatten object or manual setup

### Issue 3: Invalid Generated Config

**Symptoms**:
- Schema validation errors
- Tools don't load

**Diagnosis**:
```javascript
// Check generated config
cat mcp_apps.json

// Validate against schema
npx ajv validate -s mcp_apps.schema.json -d mcp_apps.json
```

**Common Errors**:

1. **Missing $schema**:
   ```json
   // ❌ Missing
   { "remotes": [...], "tools": [...] }
   
   // ✅ Include
   {
     "$schema": "../mcp_apps.schema.json",
     "remotes": [...],
     "tools": [...]
   }
   ```

2. **Invalid tool name**:
   ```json
   // ❌ CamelCase
   { "name": "userProfile" }
   
   // ✅ snake_case
   { "name": "user_profile" }
   ```

3. **Wrong remote reference**:
   ```json
   {
     "remotes": [{"name": "ui", ...}],
     "tools": [{"remote": "ui_library", ...}]  // ❌
   }
   
   // ✅ Match remote name
   {
     "remotes": [{"name": "ui", ...}],
     "tools": [{"remote": "ui", ...}]
   }
   ```

### Issue 4: Tools Not Loading

**Symptoms**:
- Config valid but tools don't appear
- Runtime errors

**Diagnosis**:
```javascript
// Check remote URL is accessible
curl http://localhost:5001/mf-manifest.json

// Check browser console
// Look for 404 or CORS errors
```

**Solutions**:

1. **Dev server not running**:
   ```bash
   # Start dev server
   npm run dev
   # or
   pnpm dev
   ```

2. **Wrong URL**:
   ```json
   // ❌ Missing trailing slash
   { "url": "http://localhost:5001" }
   
   // ✅ Include trailing slash
   { "url": "http://localhost:5001/" }
   ```

3. **CORS issues**:
   ```javascript
   // In remote's dev server config
   devServer: {
     headers: {
       'Access-Control-Allow-Origin': '*'
     }
   }
   ```

### Issue 5: Module Not Found

**Symptoms**:
- "Module './Component' not found"
- 404 for remoteEntry.js

**Solutions**:

1. **Check module path**:
   ```json
   // Must match exposes exactly
   {
     "module": "./Button",  // ✅ If exposes has './Button'
     "module": "Button"      // ❌ Missing './'
   }
   ```

2. **Check exposes in remote**:
   ```typescript
   // remote config must have:
   exposes: {
     './Button': './src/components/Button.tsx'  // Must match
   }
   ```

3. **Check export**:
   ```typescript
   // Component file must export
   export default Button;  // For exportName: 'default'
   export { Button };      // For exportName: 'Button'
   ```

### Issue 6: Version Mismatch

**Symptoms**:
- Runtime errors about incompatible versions
- "Shared module not available"

**Solutions**:

1. **Check shared dependencies**:
   ```typescript
   // Remote config
   shared: {
     react: { singleton: true, requiredVersion: '^18.0.0' }
   }
   
   // Host config
   shared: {
     react: { singleton: true, requiredVersion: '^18.0.0' }  // Must match
   }
   ```

2. **Update remote version**:
   ```json
   {
     "remotes": [
       { "name": "ui", "version": "2.0.0" }  // Update version
     ]
   }
   ```

## Debugging Steps

### Step 1: Verify Config Detection

```bash
# Check if config file exists
ls -la module-federation.config.ts

# Check content
cat module-federation.config.ts | grep -E "(name|exposes)"
```

### Step 2: Test Manual Parsing

```bash
# Extract name
cat module-federation.config.ts | grep "name:" | head -1

# Extract exposes
cat module-federation.config.ts | grep -A 10 "exposes:"
```

### Step 3: Validate Generated Config

```bash
# Pretty print
cat mcp_apps.json | jq .

# Check required fields
cat mcp_apps.json | jq '.remotes, .tools | length'

# Check schema
cat mcp_apps.json | jq '."$schema"'
```

### Step 4: Test Remote Accessibility

```bash
# Test manifest
curl http://localhost:5001/mf-manifest.json

# Test remoteEntry (from manifest)
curl http://localhost:5001/static/js/remoteEntry.js

# Check headers
curl -I http://localhost:5001/mf-manifest.json
```

## Getting Help

**Information to Provide**:

1. **Config file content**:
   ```bash
   cat module-federation.config.ts
   ```

2. **Generated mcp_apps.json**:
   ```bash
   cat mcp_apps.json
   ```

3. **Error messages**:
   - Console errors
   - Terminal output
   - Schema validation errors

4. **Environment**:
   - Node version: `node -v`
   - Package manager: `npm -v` or `pnpm -v`
   - Framework: React/Vue/etc.

5. **Runtime behavior**:
   - Dev server running? (yes/no)
   - URL accessible? (curl test result)
   - CORS errors? (browser console)

## Prevention Tips

**Before running skill**:
1. ✅ Have Module Federation config ready
2. ✅ Use static values (not dynamic)
3. ✅ Start dev server
4. ✅ Test remote URL manually

**During setup**:
1. ✅ Review extracted data
2. ✅ Validate remote URL format
3. ✅ Check tool name format
4. ✅ Verify remote references

**After generation**:
1. ✅ Validate JSON syntax
2. ✅ Check schema compliance
3. ✅ Test in consumer app
4. ✅ Monitor console for errors

## Quick Fixes

| Problem | Quick Fix |
|---------|-----------|
| "Config not found" | Use manual setup flow |
| "Cannot extract name" | Check for static string literal |
| "Invalid tool name" | Convert to snake_case manually |
| "Remote not accessible" | Start dev server, check URL |
| "Module not found" | Verify exposes key matches exactly |
| "CORS error" | Add CORS headers to dev server |
| "Version mismatch" | Align shared dependencies |
| "Schema validation failed" | Check required fields present |
