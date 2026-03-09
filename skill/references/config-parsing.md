# Config Parsing Logic

## Supported File Types

1. **module-federation.config.ts** (Priority: Highest)
2. **vmok.config.ts**
3. **rspack.config.js**
4. **webpack.config.js**

## Parsing Strategy

### TypeScript Config Files

```typescript
// module-federation.config.ts or vmok.config.ts structure:
export default {
  name: 'packageName',
  exposes: {
    './Module': './src/Module.tsx',
    '.': './src/App.tsx'
  },
  shared: {...}
}
```

**Extraction Pattern**:
```javascript
// Match name
const nameMatch = content.match(/name:\s*['"`]([^'"`]+)['"`]/);
const name = nameMatch ? nameMatch[1] : null;

// Match exposes object
const exposesMatch = content.match(/exposes:\s*\{([^}]+)\}/s);
const exposes = {};

if (exposesMatch) {
  const exposesContent = exposesMatch[1];
  const moduleMatches = exposesContent.matchAll(/['"`]([^'"`]+)['"`]\s*:\s*['"`]([^'"`]+)['"`]/g);
  
  for (const match of moduleMatches) {
    exposes[match[1]] = match[2];
  }
}
```

### Webpack/Rspack Config Files

```javascript
// webpack.config.js or rspack.config.js structure:
module.exports = {
  plugins: [
    new ModuleFederationPlugin({
      name: 'packageName',
      filename: 'remoteEntry.js',
      exposes: {
        './Component': './src/Component'
      }
    })
  ]
}
```

**Extraction Pattern**:
```javascript
// Find ModuleFederationPlugin
const pluginMatch = content.match(/ModuleFederationPlugin\s*\(\s*\{([^}]+)\}/s);

if (pluginMatch) {
  const pluginContent = pluginMatch[1];
  
  // Extract name
  const nameMatch = pluginContent.match(/name:\s*['"`]([^'"`]+)['"`]/);
  
  // Extract exposes
  const exposesMatch = pluginContent.match(/exposes:\s*\{([^}]+)\}/s);
}
```

## Edge Cases

### Dynamic Name

```typescript
// Case 1: Variable reference
const pkgName = 'demo_provider';
export default {
  name: pkgName,  // ❌ Cannot extract
  exposes: {...}
}

// Case 2: Computed value
export default {
  name: process.env.APP_NAME,  // ❌ Cannot extract
  exposes: {...}
}

// Solution: Fall back to package.json name
```

**Ask**:
- Is `name` a string literal or variable?
- If variable, read package.json as fallback

### Dynamic Exposes

```typescript
// Case: Generated exposes
const components = ['Button', 'Input', 'Select'];
const exposes = components.reduce((acc, comp) => ({
  ...acc,
  [`./${comp}`]: `./src/${comp}.tsx`
}), {});

export default { name: 'ui', exposes };  // ❌ Cannot extract
```

**Solution**: Prompt user to manually specify

### Function Export

```typescript
// Case: Config is a function
export default function(env, argv) {
  return {
    name: env.APP_NAME,  // Dynamic
    exposes: {...}
  };
}
```

**Ask**:
- "Config exports a function. What are the runtime values?"
- Suggest: "Consider using static config or provide values manually"

## Validation

After extraction, validate:

```javascript
function validate(data) {
  // ✅ Required fields
  if (!data.name) {
    throw new Error('Missing "name" field');
  }
  
  if (!data.exposes || Object.keys(data.exposes).length === 0) {
    throw new Error('Missing or empty "exposes" field');
  }
  
  // ✅ Name format
  if (!/^[a-z0-9_-]+$/i.test(data.name)) {
    console.warn('Name contains unusual characters:', data.name);
  }
  
  // ✅ Exposes keys
  for (const key of Object.keys(data.exposes)) {
    if (!key.startsWith('./') && key !== '.') {
      console.warn('Exposes key should start with "./" or be ".":', key);
    }
  }
}
```

## Fallback Strategy

```
1. Try module-federation.config.ts
   ↓ Not found
2. Try vmok.config.ts
   ↓ Not found
3. Try rspack.config.js
   ↓ Not found
4. Try webpack.config.js
   ↓ Not found
5. Prompt: "No MF config found. Proceed with manual setup?"
```

## Common Patterns

### Monorepo Package

```typescript
// packages/ui-components/module-federation.config.ts
export default {
  name: '@company/ui',  // Scoped package
  exposes: {
    './Button': './src/Button',
    './Input': './src/Input'
  }
}
```

**Note**: Scoped names valid, keep as-is

### Shared Modules

```typescript
export default {
  name: 'app',
  exposes: {
    './store': './src/store',      // Non-component
    './utils': './src/utils',      // Non-component
    './App': './src/App'           // Component
  }
}
```

**Note**: All exposes become tools (MCP Apps supports any JS export)
