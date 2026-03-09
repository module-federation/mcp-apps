# 04 · mcp_apps.json 配置参考

`mcp_apps.json` 是整个方案的核心配置文件，描述了你的 MF 远程模块和要注册的 MCP 工具。

## 完整结构示例

```json
{
  "$schema": "./mcp_apps.schema.json",
  "version": "1.0.0",
  "remotes": [
    {
      "name": "my_app",
      "version": "1.2.3",
      "baseUrl": "https://cdn.example.com/my-app",
      "locale": "zh",
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
      "description": "工具描述，会被 Claude 读取来决定何时调用",
      "inputSchema": {
        "type": "object",
        "properties": {
          "param1": { "type": "string", "description": "参数说明" }
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

## `remotes[]` 字段

### `name` · string · 必填

远程模块的唯一标识符。

- 开源 MF 项目：通常是 `module-federation.config.ts` 里的 `name` 字段，只能用小写字母、数字、下划线
- ByteDance vmok 包：用 npm 包名，如 `@cloud-public/goofy-deploy`

```json
"name": "my_app"
"name": "@cloud-public/goofy-deploy"
```

---

### `version` · string · 必填

远程模块的版本号。

- `"mf"` 类型远程：版本对实际 URL 构建无影响，填 `"latest"` 或任意字符串即可
- `"vmok"` 类型远程：版本会被嵌入 URL，格式为 `baseUrl/version/locale/vmok-manifest.json`

```json
"version": "latest"          // mf 类型
"version": "1.0.0.9652"      // vmok 类型（精确版本）
```

---

### `baseUrl` · string · 必填

组件的 CDN 基础路径（不含版本和 locale）。

- 必须是完整 URL（`http://` 或 `https://` 开头）
- 不要以 `/` 结尾
- 本地开发时用 `http://localhost:<port>`

**URL 构建规则**：

| manifestType | 实际请求 URL |
|---|---|
| `"mf"` | `{baseUrl}/mf-manifest.json` |
| `"vmok"` | `{baseUrl}/{version}/{locale}/vmok-manifest.json` |

```json
"baseUrl": "http://localhost:3001"
"baseUrl": "https://cdn.example.com/my-project"
"baseUrl": "https://unpkg.com/@cloud-public/my-package"
```

---

### `locale` · string · 可选，默认 `"en"`

语言/地区标识。

- `"mf"` 类型：不影响 URL，可以省略
- `"vmok"` 类型：嵌入 URL，如 `"cn"` 对应 `vmok-manifest.json` 路径中的 `cn` 目录

```json
"locale": "en"
"locale": "cn"
"locale": "zh"
```

---

### `manifestType` · `"mf"` | `"vmok"` · 可选，默认 `"vmok"`

远程模块的 manifest 格式：

| 值 | 说明 | 适用场景 |
|----|------|---------|
| `"mf"` | 开源 Module Federation，产出 `mf-manifest.json` | 自己的项目、开源 MF 项目 |
| `"vmok"` | 字节跳动内部 vmok 格式，产出 `vmok-manifest.json` + `vmok-snapshot.json` | ByteDance 内部发布的 vmok 包 |

```json
"manifestType": "mf"     // 你自己的项目
"manifestType": "vmok"   // 字节内部 vmok 包
```

---

### `csp` · object · 必填

Content Security Policy 配置，控制 iframe 内可以访问的域名。

> **重要**：每个域名都必须包含完整协议头！
> - ✅ `"https://cdn.example.com"`
> - ✅ `"http://localhost:3001"`
> - ❌ `"cdn.example.com"` （无协议头，CSP 会忽略）
> - ❌ `"localhost:3001"` （无协议头，CSP 会忽略）

#### `csp.connectDomains` · string[] · 必填

允许组件 `fetch/XHR` 访问的域名列表（对应 CSP `connect-src` 指令）。

需要包含：
1. `baseUrl` 的 origin（加载 manifest 和 snapshot）
2. 组件内 `fetch` 调用的所有 API 域名
3. vmok 远程：`vmok-snapshot.json` 里 `getPublicPath` 指向的 CDN 域名（可能与 `baseUrl` 不同）

```json
"connectDomains": [
  "http://localhost:3001",
  "https://api.example.com",
  "*.bytedance.net"
]
```

支持通配符（`*.example.com`）匹配所有子域名。

#### `csp.resourceDomains` · string[] · 必填

允许加载脚本/资源的域名（对应 CSP `script-src` 指令）。

需要包含：
1. `baseUrl` 的 origin
2. 实际托管 JS chunk 的 CDN（vmok 中可能是独立的 CDN，需从 `getPublicPath` 提取）

```json
"resourceDomains": [
  "http://localhost:3001",
  "https://cdn.example.com"
]
```

#### `csp.frameDomains` · string[] · 可选

允许加载的 iframe 来源（对应 CSP `frame-src`）。一般不需要设置。

#### `csp.baseUriDomains` · string[] · 可选

`base-uri` 限制，一般不需要设置。

---

### vmok 远程的 CSP 特殊处理

对于 vmok 类型的远程，实际 JS chunk 可能由与 `baseUrl` **不同的 CDN** 托管（通过 `getPublicPath` 字段指定）。

排查方法：
```bash
# 1. 获取 snapshot URL
curl https://your-cdn.example.com/pkg/1.0.0/cn/vmok-snapshot.json | python3 -m json.tool | grep -A2 getPublicPath

# 输出示例：
# "getPublicPath": "return \"//cdn-tos.example.net/serverless/my-app/1.0.0/\""

# 2. 把 cdn-tos.example.net 加入 connectDomains 和 resourceDomains
```

---

## `tools[]` 字段

### `name` · string · 必填

工具的唯一标识符，作为 MCP 工具名暴露给 Claude。

- 必须是 `snake_case`（小写字母、数字、下划线）
- 必须全局唯一（在整个 `mcp_apps.json` 内）
- Claude 会根据此名字决定调用哪个工具

```json
"name": "show_application_list"
"name": "deploy_wizard_step1"
```

---

### `title` · string · 必填

工具的人类可读标题，显示在 Claude 的工具列表中。

```json
"title": "Show Application List"
"title": "部署向导 Step1：选择应用"
```

---

### `description` · string · 必填

工具的描述，**这是 Claude 理解工具用途的主要依据**，写得越清晰 Claude 调用越准确。

最佳实践：
- 说明工具展示什么 UI
- 说明用户可以做什么操作
- 说明调用后会发生什么（如"用户确认后，组件会自动触发 step2"）
- 对于不应被主动调用的工具，明确注明"由 XXX 自动触发，请勿主动调用"

```json
"description": "展示应用列表，让用户选择要部署的应用。用户选择后，组件会自动触发 deploy_wizard_step2。"
```

---

### `inputSchema` · object · 可选，默认 `{}`

工具参数的 JSON Schema 定义。Claude 会根据此 schema 决定传入哪些参数。

```json
"inputSchema": {
  "type": "object",
  "properties": {
    "appId": {
      "type": "string",
      "description": "应用 ID（必填）"
    },
    "env": {
      "type": "string",
      "enum": ["production", "staging", "canary"],
      "default": "production",
      "description": "部署环境"
    },
    "count": {
      "type": "number",
      "description": "显示数量",
      "default": 10
    }
  },
  "required": ["appId"]
}
```

这些参数会作为 props 直接传给组件（`<Component appId="..." env="..." />`）。

> **不需要在 `inputSchema` 里声明 `mcpApp`**，它由框架自动注入。

---

### `visibility` · `("model" | "app")[]` · 可选，默认 `["model", "app"]`

控制工具对谁可见、谁可以调用。

| 值 | 含义 |
|----|------|
| `["model", "app"]` | **默认值**。Claude Agent 可调用，组件也可通过 `callServerTool` 调用 |
| `["model"]` | 只有 Claude Agent 可调用，不出现在组件的可调用列表 |
| `["app"]` | 只有组件可通过 `callServerTool` 调用，**不出现在 Claude 工具列表** |

```json
"visibility": ["model", "app"]   // 默认，双方都可调用
"visibility": ["app"]            // 纯组件内部工具，Claude 看不到
"visibility": ["model"]          // Agent 专属触发，组件不可直接调
```

**典型用法**：
- 数据获取工具（`["app"]`）：仅组件通过 `callServerTool` 使用，防止 Agent 乱调用
- UI 展示工具（`["model", "app"]`）：Claude 主动展示 + 组件可链式触发
- Wizard 中间步骤（`["model"]`）：只允许 Agent 按顺序触发

---

### `remote` · string · 必填

引用 `remotes[]` 中的哪个远程，填写对应的 `name` 值。

```json
"remote": "my_app"
"remote": "@cloud-public/goofy-deploy"
```

---

### `module` · string · 必填

Module Federation `exposes` 中的模块路径，对应 `module-federation.config.ts` 中 `exposes` 的 key。

```json
// module-federation.config.ts:
// exposes: { './ApplicationList': './src/components/ApplicationList.tsx' }

"module": "./ApplicationList"
```

---

### `exportName` · string · 可选，默认 `"default"`

从模块中导出的名称。

- 大多数情况下用 `"default"`（默认导出）
- 如果你的组件是具名导出，填写导出名称

```json
// export default MyComponent;  →  "exportName": "default"
// export { MyComponent };      →  "exportName": "MyComponent"
```

---

## 完整示例：本地开发

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
        "connectDomains": ["http://localhost:3001", "https://httpbin.org"],
        "resourceDomains": ["http://localhost:3001"]
      }
    }
  ],
  "tools": [
    {
      "name": "hello_widget",
      "title": "Hello Widget",
      "description": "展示一个打招呼组件",
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

## 完整示例：生产 CDN

```json
{
  "$schema": "./mcp_apps.schema.json",
  "version": "1.0.0",
  "remotes": [
    {
      "name": "shop_frontend",
      "version": "2.1.0",
      "baseUrl": "https://cdn.mycompany.com/shop-frontend",
      "locale": "zh",
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
      "title": "商品列表",
      "description": "展示商品列表，用户可以筛选和选择商品",
      "inputSchema": {
        "type": "object",
        "properties": {
          "category": { "type": "string", "description": "商品分类" },
          "page": { "type": "number", "default": 1 }
        }
      },
      "remote": "shop_frontend",
      "module": "./ProductList"
    }
  ]
}
```
