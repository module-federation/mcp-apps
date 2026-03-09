# 03 · 高级功能

## 一、全屏模式（requestDisplayMode）

组件默认以 `inline` 模式渲染（嵌在对话流中）。可以切换到 `fullscreen` 获得更大的展示空间：

```tsx
import React, { useState } from 'react';

interface Props {
  mcpApp?: {
    requestDisplayMode?: (params: { mode: 'inline' | 'fullscreen' }) => Promise<{ mode: string }>;
  };
}

const FullscreenDemo: React.FC<Props> = ({ mcpApp }) => {
  const [mode, setMode] = useState<'inline' | 'fullscreen'>('inline');

  const toggle = async () => {
    if (!mcpApp?.requestDisplayMode) return;
    const newMode = mode === 'inline' ? 'fullscreen' : 'inline';
    const result = await mcpApp.requestDisplayMode({ mode: newMode });
    setMode(result.mode as 'inline' | 'fullscreen');
  };

  return (
    <div>
      <button onClick={toggle}>
        {mode === 'fullscreen' ? '退出全屏' : '全屏展示'}
      </button>
      {/* 你的主要内容 */}
    </div>
  );
};
```

> **注意**：`requestDisplayMode` 是 MCP Apps 协议的一部分，实际是否支持取决于 MCP Host（如 Claude Desktop）。宿主可能忽略此请求。

---

## 二、Tool Visibility（工具可见性）

`visibility` 控制一个工具对谁可见、谁可以调用它：

| 值 | 含义 |
|----|------|
| `["model", "app"]` | **默认值**。Claude Agent 可以调用，组件也可以通过 `callServerTool` 调用 |
| `["model"]` | 只有 Claude Agent 可以调用（工具不出现在组件的可调用列表中） |
| `["app"]` | 只有组件可以通过 `callServerTool` 调用，不出现在 Claude 的工具列表中 |

### 在 mcp_apps.json 中设置 visibility

在 `mcp_apps.json` 的 tool 配置中添加 `visibility` 字段即可：

```json
{
  "tools": [
    {
      "name": "internal_helper",
      "title": "Internal Helper",
      "description": "只供组件调用，不出现在 Claude 工具列表",
      "visibility": ["app"],
      "remote": "my_app",
      "module": "./InternalHelper"
    }
  ]
}
```

**典型用法**：

- **纯 UI 工具**（`["model", "app"]`）：Claude 可以主动调用展示界面，组件也可以 `callServerTool` 调用
- **后台数据工具**（`["app"]`）：只作为组件的数据获取手段，不暴露给 Agent，防止 Agent 乱调用
- **Agent 专属工具**（`["model"]`）：只有 Agent 能触发，用于 Wizard 中间步骤（但组件用 `sendMessage` 间接触发也能达到同样效果）

---

## 三、proxyFetch：组件主动调用 fetch_remote_resource

内置的 `fetch_remote_resource` 工具是一个 CORS 代理，通过 Node.js 层发 HTTP 请求。

### 直接调用

```tsx
const result = await mcpApp.callServerTool({
  name: 'fetch_remote_resource',
  arguments: {
    url: 'https://api.example.com/v1/users',
    method: 'GET',
    headers: {
      'Authorization': 'Bearer your-token',
      'Accept': 'application/json',
    },
  },
});

if (!result.isError) {
  // result.content[0].text 是一个 JSON 字符串，包含 status / headers / body
  const response = JSON.parse(result.content[0].text!);
  console.log('Status:', response.status);
  console.log('Body:', response.body); // 字符串，需要再 parse
  const data = JSON.parse(response.body);
}
```

返回结构：

```typescript
{
  status: number;           // HTTP 状态码
  statusText: string;       // 如 "OK"
  headers: Record<string, string>;
  body: string;             // 响应体文本（GET 请求时有）
}
```

### 封装成 hook

```tsx
// hooks/useProxyFetch.ts
import { useCallback } from 'react';
import type { McpApp } from '../types/mcp';

export function useProxyFetch(mcpApp?: McpApp) {
  return useCallback(async <T = any>(
    url: string,
    options: { method?: 'GET' | 'HEAD'; headers?: Record<string, string> } = {}
  ): Promise<T> => {
    if (!mcpApp?.callServerTool) {
      throw new Error('mcpApp not available');
    }

    const result = await mcpApp.callServerTool({
      name: 'fetch_remote_resource',
      arguments: { url, method: options.method || 'GET', headers: options.headers },
    });

    if (result.isError) {
      throw new Error(result.content[0]?.text || 'fetch failed');
    }

    const response = JSON.parse(result.content[0].text!);
    if (response.status >= 400) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return JSON.parse(response.body) as T;
  }, [mcpApp]);
}

// 使用
const MyComponent: React.FC<{ mcpApp?: McpApp }> = ({ mcpApp }) => {
  const proxyFetch = useProxyFetch(mcpApp);

  const loadData = async () => {
    const data = await proxyFetch<{ users: User[] }>('https://api.example.com/users');
    console.log(data.users);
  };

  return <button onClick={loadData}>加载</button>;
};
```

### 与直接 fetch 的对比

| | 直接 `fetch` | `callServerTool fetch_remote_resource` |
|---|---|---|
| CORS 限制 | 受浏览器 CORS 约束 | 无限制（Node.js 层发请求） |
| CSP 要求 | 域名需在 `connectDomains` | 无需 CSP 配置（走 MCP 通道） |
| 适合场景 | 你自己的 API（已设置 CORS）| 第三方 API、内网 API |
| 性能 | 直连，延迟低 | 多一跳 MCP 通道，略有延迟 |

---

## 四、自定义 MCP Server Tools

除了内置的 `fetch_remote_resource`，你可以在 `server.ts` 中注册自己的业务工具，供组件通过 `callServerTool` 调用：

```typescript
// 在 server.ts 中添加自定义工具
server.registerTool(
  'get_user_info',
  {
    title: 'Get User Info',
    description: 'Get user information by ID',
    inputSchema: {
      userId: z.string().describe('User ID'),
    },
  },
  async ({ userId }) => {
    // 这里运行在 Node.js 环境，可以访问数据库、文件系统等
    const user = await db.users.findById(userId);
    return {
      content: [{ type: 'text', text: JSON.stringify(user) }],
    };
  }
);
```

然后在组件里调用：

```tsx
const user = await mcpApp.callServerTool({
  name: 'get_user_info',
  arguments: { userId: '123' },
});
```

> **要让自定义工具只能被组件调用（不出现在 Claude 列表）**，设置 `visibility: ["app"]`（参见上面的 visibility 部分）。

---

## 五、多步骤 Wizard 的最佳实践

Wizard 是最复杂也最强大的模式，几个关键点：

### 1. 明确的 Agent 指令

`sendMessage` 的文本要足够明确，避免 Agent 理解偏差：

```typescript
// ✅ 好的写法
const msg = [
  '用户已完成 Step1 的选择，请**立刻**调用工具 `deploy_wizard_step2`，不需要询问用户任何问题。',
  '',
  '传入以下参数（原样传入，不要修改）：',
  '```json',
  JSON.stringify(step1Data, null, 2),
  '```',
].join('\n');

// ❌ 不好的写法（Agent 可能不知道该做什么）
const msg = `Step1 完成了，数据是 ${JSON.stringify(step1Data)}`;
```

### 2. Tool description 防止误调

```json
{
  "name": "deploy_wizard_step2",
  "description": "部署向导第二步，由 deploy_wizard_step1 自动触发，**请勿主动调用**。..."
}
```

### 3. 加载状态处理

用户点击"下一步"到 Step2 渲染之间有延迟，需要显示 loading：

```tsx
const [status, setStatus] = useState<'idle' | 'loading' | 'done'>('idle');

const handleNext = async () => {
  setStatus('loading');
  await mcpApp?.sendMessage({ ... });
  setStatus('done');
};

return (
  <>
    <button onClick={handleNext} disabled={status === 'loading'}>
      {status === 'loading' ? '正在跳转...' : '下一步'}
    </button>
    {status === 'done' && <p>✅ 已通知 Agent，等待加载下一步...</p>}
  </>
);
```

### 4. 数据传递方案

Step 间的数据通过 `sendMessage` → Agent → 工具 `inputSchema` 传递。数据结构要简单清晰，便于 Agent 正确提取。避免嵌套过深或字段名歧义。

---

## 六、组件内错误处理

```tsx
import { ErrorBoundary } from 'react-error-boundary';

function ErrorFallback({ error }: { error: Error }) {
  return (
    <div style={{ padding: 20, color: 'red' }}>
      <h3>组件加载失败</h3>
      <p>{error.message}</p>
    </div>
  );
}

// 用 ErrorBoundary 包裹你的组件，防止错误冒泡
const SafeWidget = () => (
  <ErrorBoundary FallbackComponent={ErrorFallback}>
    <MyWidget />
  </ErrorBoundary>
);
```

MCP App 宿主已经有一层全局 `ErrorBoundary`，但建议你的组件也自行处理，提供更好的错误提示。
