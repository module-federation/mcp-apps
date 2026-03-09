# 01 · 快速开始

> 目标：从一个完全普通的前端项目，完成接入，在 Claude Desktop 里看到你的组件。

## 总体步骤

```
Step 1  给你的项目添加 Module Federation 配置
Step 2  编写一个 MCP-aware 组件
Step 3  构建 & 本地启动（或部署到 CDN）
Step 4  用 Skill 生成 mcp_apps.json（告诉 Claude "帮我生成 mcp_apps.json"）
Step 5  注册到 Claude Desktop
Step 6  测试
```

---

## Step 1：添加 Module Federation 到你的项目

### 安装依赖

```bash
# 如果你用 Rspack / Modern.js（推荐）
npm install @module-federation/modern-js-v3 --save-dev

# 如果你用 Webpack
npm install @module-federation/webpack --save-dev

# 如果你用 Vite
npm install @originjs/vite-plugin-federation --save-dev
```

### 添加 MF 配置文件

在项目根目录创建 `module-federation.config.ts`：

```typescript
// module-federation.config.ts
import { createModuleFederationConfig } from '@module-federation/modern-js-v3';

export default createModuleFederationConfig({
  name: 'my_app',           // 唯一标识，只能用小写字母、数字、下划线
  exposes: {
    './HelloWidget': './src/components/HelloWidget.tsx',
    // 后续每个要暴露给 Claude 的组件都在这里注册
  },
  shared: {
    react: { singleton: true },
    'react-dom': { singleton: true },
  },
});
```

> **命名规则**：`name` 必须是 snake_case（如 `my_app`、`shop_frontend`），不能包含 `-` 或 `/`，除非是 npm scoped 包名（如 `@cloud-public/goofy-deploy`）。

### 在构建工具中引用

**Modern.js / Rspack：**

```typescript
// rspack.config.ts 或 modern.config.ts
import mfConfig from './module-federation.config';
import { ModuleFederationPlugin } from '@module-federation/rspack';

export default {
  plugins: [
    new ModuleFederationPlugin(mfConfig),
  ],
};
```

**Webpack：**

```javascript
// webpack.config.js
const { ModuleFederationPlugin } = require('@module-federation/webpack');
const mfConfig = require('./module-federation.config');

module.exports = {
  plugins: [
    new ModuleFederationPlugin(mfConfig),
  ],
};
```

---

## Step 2：编写你的第一个 MCP 组件

创建 `src/components/HelloWidget.tsx`：

```tsx
import React from 'react';

interface HelloWidgetProps {
  // 从 mcp_apps.json 的 inputSchema 注入的 props
  name?: string;
  
  // mcpApp 是 MCP 框架自动注入的，不需要在 inputSchema 中声明
  // 用它来和 Claude Agent 通信
  mcpApp?: {
    sendMessage?: (params: {
      role: string;
      content: Array<{ type: string; text: string }>;
    }) => Promise<{ isError?: boolean }>;
    callServerTool?: (params: {
      name: string;
      arguments?: Record<string, unknown>;
    }) => Promise<{ content: Array<{ type: string; text?: string }>; isError?: boolean }>;
  };
}

const HelloWidget: React.FC<HelloWidgetProps> = ({ name = 'World', mcpApp }) => {
  const handleClick = async () => {
    if (!mcpApp?.sendMessage) return;
    
    // 向 Claude Agent 发送消息
    await mcpApp.sendMessage({
      role: 'user',
      content: [{ type: 'text', text: `用户点击了按钮！name=${name}` }],
    });
  };

  return (
    <div style={{ padding: '20px', fontFamily: 'system-ui' }}>
      <h2>Hello, {name}!</h2>
      <button onClick={handleClick}>
        发消息给 Claude
      </button>
    </div>
  );
};

export default HelloWidget;
```

> **关键点**：`mcpApp` prop 由 MCP 框架在渲染时自动注入，你的组件声明它就能用，不需要任何额外配置。

---

## Step 3：构建并启动

```bash
# 构建
npm run build

# 本地开发服务器（例如端口 3001）
npm run dev -- --port 3001
# 或
npx serve dist -p 3001
```

构建产物中应包含：
- `mf-manifest.json`（MF 模块描述文件）
- 组件的 chunk JS 文件

验证是否成功：
```bash
curl http://localhost:3001/mf-manifest.json
# 应返回包含 "exposes" 的 JSON
```

---

## Step 4：生成 mcp_apps.json

`mcp_apps.json` 通过内置 Skill **自动生成**，无需手写。在项目根目录（含 `module-federation.config.ts`），直接告诉 Claude：

> "帮我生成 mcp_apps.json"

Skill 会自动：
1. 检测 `module-federation.config.ts`，提取 `name` 和 `exposes`
2. 询问 CDN base URL、版本号、locale
3. 生成完整的 `mcp_apps.json`（包含 remotes、tools、CSP 配置）
4. 复制 `mcp_apps.schema.json` 到项目根目录

**生成结果示例**：
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
      "description": "展示一个打招呼组件，可以向 Claude 发消息",
      "inputSchema": {
        "type": "object",
        "properties": {
          "name": {
            "type": "string",
            "description": "要打招呼的名字",
            "default": "World"
          }
        }
      },
      "remote": "my_app",
      "module": "./HelloWidget",
      "exportName": "default"
    }
  ]
}
```

> **后续添加组件**：新增了 `exposes` 模块后，直接说 "把 NewComponent 加到 mcp_apps.json"，Skill 会追加新 tool 而不影响已有配置。

> **手动创建**：如需手工编写，参考 [04 · 配置参考](./04-config-reference.md)。

---

## Step 5：注册到 Claude Desktop

编辑 `~/Library/Application Support/Claude/claude_desktop_config.json`：

**推荐方式：本地 node 直接运行**

```json
{
  "mcpServers": {
    "my-mf-tools": {
      "command": "/absolute/path/to/node",
      "args": [
        "/absolute/path/to/module-federation-mcp/dist/index.js",
        "--config",
        "/absolute/path/to/mcp_apps.json",
        "--stdio"
      ]
    }
  }
}
```

> **注意**：路径必须是绝对路径。可以用 `which node` 获取 node 路径，`pwd` 确认当前目录。

**通过 npx 运行（需 Node 18+）**

Claude Desktop 启动 MCP Server 时使用系统默认 PATH。如果你的系统 Node 版本低于 18（可用 `node -v` 确认），需要显式指定 Node 18+ 的 npx 路径并覆盖 PATH：

```json
{
  "mcpServers": {
    "my-mf-tools": {
      "command": "/Users/yourname/.nvm/versions/node/v22.x.x/bin/npx",
      "args": [
        "-y",
        "@module-federation/mcp-server@latest",
        "--stdio"
      ],
      "env": {
        "MF_MCP_CONFIG": "/absolute/path/to/mcp_apps.json",
        "PATH": "/Users/yourname/.nvm/versions/node/v22.x.x/bin:/usr/local/bin:/usr/bin:/bin"
      }
    }
  }
}
```

> **为什么要覆盖 PATH？** npx 运行包时会 spawn 子进程，子进程继承 Claude Desktop 的 PATH。若系统 PATH 里老版本 Node 排在前面，子进程仍会用旧版本执行，导致 `@hono/node-server` 兼容性错误。通过 `env.PATH` 把 Node 18+ 路径置顶可彻底解决。

---

## Step 6：测试

1. 完全退出并重启 Claude Desktop
2. 在 Claude 对话框里点击工具图标，确认 `hello_widget` 出现在列表中
3. 对 Claude 说："帮我调用 hello_widget，name 设为 Alice"
4. Claude 应该渲染出你的组件

---

## Troubleshooting

### 工具没有出现在 Claude 工具列表

- 检查 `claude_desktop_config.json` 语法是否正确（可以用 `python3 -m json.tool` 验证）
- 确认 `dist/index.js` 路径存在：`ls /path/to/module-federation-mcp/dist/index.js`
- 查看 MCP Server 日志：`tail -f ~/Library/Logs/Claude/mcp-server-my-mf-tools.log`

### Server disconnected / `TypeError: Class extends value undefined`

日志中出现如下错误：

```
npm WARN EBADENGINE current: { node: 'v16.x.x' }
TypeError: Class extends value undefined is not a constructor or null
    at .../node_modules/@hono/node-server/dist/index.mjs
```

说明 Claude Desktop 用了低版本 Node（< 18）来执行 npx。解决方法：

1. **推荐**：改用 `node` 直接运行本地 `dist/index.js`（见 Step 5 推荐方式）
2. 或在 `claude_desktop_config.json` 的 `env` 里显式设置 `PATH`，把 Node 18+ 路径排到最前面

### `TypeError: Failed to fetch` / RUNTIME-003

- 最常见原因：`connectDomains` 里的域名缺少协议头，改为 `"http://localhost:3001"` 而不是 `"localhost:3001"`
- 确认你的本地服务器正在运行：`curl http://localhost:3001/mf-manifest.json`

### 组件渲染空白

- 打开 Claude DevTools（`Help → Enable Developer Mode` → `View → Toggle Developer Tools`）
- 查看 Console 里的错误信息
- 常见原因：`module` 路径与 `exposes` 中的 key 不匹配，例如 `exposes` 是 `./HelloWidget` 但 `module` 写成了 `./hellowidget`
