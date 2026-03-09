# Tool Generation Rules

## Naming Convention

### Step 1: Extract Module Name

From exposes key:
```
'./' → remove
'.' → special case
'./ComponentName' → 'ComponentName'
```

### Step 2: Convert to snake_case

```javascript
function toSnakeCase(str) {
  // PascalCase → snake_case
  return str
    .replace(/([A-Z])/g, '_$1')
    .toLowerCase()
    .replace(/^_/, '');
}
```

**Examples**:
```
'UserProfile' → 'user_profile'
'ApplicationList' → 'application_list'
'APIClient' → 'api_client'
```

### Step 3: Handle Special Cases

| Exposes Key | Tool Name | Logic |
|-------------|-----------|-------|
| `'.'` | `{packageName}_component` | Root export |
| `'./'` | `{packageName}_component` | Empty path |
| `'./index'` | `{packageName}` | Index file |
| `'./Button'` | `button` | Normal component |

### Step 4: Generate Display Name

```javascript
function toTitleCase(snakeName) {
  return snakeName
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}
```

**Examples**:
```
'user_profile' → 'User Profile'
'application_list' → 'Application List'
'api_client' → 'Api Client'
```

## Description Generation

Template:
```
"A {module} component from {packageName}"
```

Examples:
```
module: '.', package: 'demo_provider'
→ "A demo component from demo_provider"

module: './Button', package: '@ui/components'
→ "A Button component from @ui/components"
```

## Complete Example

```typescript
// Input
exposes: {
  '.': './src/App.tsx',
  './Button': './src/Button.tsx',
  './UserProfile': './src/UserProfile.tsx'
}
packageName: 'demo_provider'

// Output
tools: [
  {
    name: 'provider_component',           // '.' special case
    title: 'Provider Component',
    description: 'A demo component from demo_provider',
    remote: 'demo_provider',
    module: '.',
    exportName: 'default'
  },
  {
    name: 'button',                        // './Button' → 'button'
    title: 'Button',
    description: 'A Button component from demo_provider',
    remote: 'demo_provider',
    module: './Button',
    exportName: 'default'
  },
  {
    name: 'user_profile',                  // PascalCase → snake_case
    title: 'User Profile',
    description: 'A UserProfile component from demo_provider',
    remote: 'demo_provider',
    module: './UserProfile',
    exportName: 'default'
  }
]
```

## Validation Rules

- ✅ Tool name must be snake_case
- ✅ Tool name must be unique
- ✅ Tool name must not contain special chars except `_`
- ✅ Title must be Title Case
- ✅ Module must match exposes key
- ✅ Remote must match package name
