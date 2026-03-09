# 02 · 组件开发指南

> 本章介绍如何在 MF 组件内处理渲染、Props 注入和与 Agent 的双向通信。

## Props 注入机制

当 Claude 调用一个工具时，发生了以下事情：

```
Claude 调用 tool(args)
  → MCP Server 把 args 打包进 resource 配置
  → MCP App (iframe) 接收配置
  → 加载你的 MF 组件
  → 以 {...args, mcpApp} 作为 props 渲染组件
```

所以你的组件 props 分为两类：

| Props 来源 | 说明 |
|-----------|------|
| `inputSchema` 中声明的字段 | Claude 调用工具时传入，来自用户/Agent 的参数 |
| `mcpApp` | MCP 框架**自动注入**，无需在 `inputSchema` 声明 |

---

## 完整的 Props 类型定义

建议在你的项目里复制这份类型定义：

```typescript
// types/mcp.ts

export interface McpApp {
  /**
   * 调用 MCP Server 上注册的工具
   * 可以调用你自己注册的任何工具，也可以调用内置的 fetch_remote_resource
   */
  callServerTool: (params: {
    name: string;
    arguments?: Record<string, unknown>;
  }) => Promise<{
    content: Array<{ type: string; text?: string }>;
    isError?: boolean;
  }>;

  /**
   * 向 Claude Agent 发送一条用户消息
   * Agent 会把这条消息当作用户输入处理，触发新一轮思考/工具调用
   */
  sendMessage?: (params: {
    role: 'user';
    content: Array<{ type: 'text'; text: string }>;
  }) => Promise<{ isError?: boolean }>;
}
```

---

## 场景一：纯展示组件

只接收 props 并渲染 UI，不需要与 Agent 通信：

```tsx
interface AppListProps {
  appType?: string;
  env?: string;
  locale?: 'en' | 'zh';
  mcpApp?: McpApp; // 声明但不使用也没关系
}

const AppList: React.FC<AppListProps> = ({ appType = 'Web', env, locale = 'zh' }) => {
  const [apps, setApps] = useState([]);

  useEffect(() => {
    // 直接 fetch 你自己的 API（需要在 csp.connectDomains 里允许该域名）
    fetch(`/api/apps?type=${appType}&env=${env}`)
      .then(r => r.json())
      .then(setApps);
  }, [appType, env]);

  return (
    <ul>
      {apps.map(app => <li key={app.id}>{app.name}</li>)}
    </ul>
  );
};
```

---

## 场景二：组件向 Agent 发消息（sendMessage）

用户在组件内完成操作后，把结果告诉 Claude，让 Claude 继续后续流程：

```tsx
const ConfirmForm: React.FC<{ mcpApp?: McpApp }> = ({ mcpApp }) => {
  const [value, setValue] = useState('');

  const handleSubmit = async () => {
    if (!mcpApp?.sendMessage) {
      alert('未运行在 MCP 环境中');
      return;
    }

    // 发给 Agent 的消息会出现在对话里，Agent 会根据内容继续操作
    await mcpApp.sendMessage({
      role: 'user',
      content: [{
        type: 'text',
        text: `用户提交了表单，值为：${value}。请继续下一步。`,
      }],
    });
  };

  return (
    <div>
      <input value={value} onChange={e => setValue(e.target.value)} />
      <button onClick={handleSubmit}>提交</button>
    </div>
  );
};
```

> **`sendMessage` 的本质**：它将一条消息注入到 Claude 的对话上下文中，就像用户手动输入了这条文字一样。Claude 会据此做出响应（调用工具、回答问题等）。

---

## 场景三：组件调用 MCP Server Tool（callServerTool）

组件可以在浏览器端直接调用 MCP Server 上注册的任何工具，绕过 CORS 限制通过 Node.js 层发请求：

```tsx
const DataPanel: React.FC<{ mcpApp?: McpApp }> = ({ mcpApp }) => {
  const [data, setData] = useState<any>(null);

  const fetchData = async () => {
    if (!mcpApp?.callServerTool) return;

    // 调用内置的 fetch_remote_resource 工具，通过 Node.js 代理请求
    const result = await mcpApp.callServerTool({
      name: 'fetch_remote_resource',
      arguments: {
        url: 'https://api.example.com/data',
        method: 'GET',
        headers: { 'Authorization': 'Bearer token123' },
      },
    });

    if (!result.isError && result.content[0]?.text) {
      const body = JSON.parse(result.content[0].text);
      setData(body);
    }
  };

  return (
    <div>
      <button onClick={fetchData}>加载数据</button>
      {data && <pre>{JSON.stringify(data, null, 2)}</pre>}
    </div>
  );
};
```

> **为什么需要 `callServerTool` 而不直接 `fetch`？**
>
> 浏览器的 CORS 策略会阻止 iframe 跨域请求大多数 API。`callServerTool` 把请求转发给 MCP Server（Node.js 进程），Node.js 没有 CORS 限制，可以请求任意 URL。
>
> 当然，如果目标 API 已经允许跨域，或者你在 `csp.connectDomains` 里添加了该域名，也可以直接 `fetch`。

---

## 场景四：多步骤 Wizard（组件链）

多个工具组件串联，每步完成后自动触发下一步。这是最强大的使用模式：

```
Step1 组件 → sendMessage 告诉 Agent → Agent 调用 step2 工具 → Step2 组件渲染
```

```tsx
// DeployWizardStep1.tsx
const DeployWizardStep1: React.FC<{ mcpApp?: McpApp }> = ({ mcpApp }) => {
  const [selectedApp, setSelectedApp] = useState('');

  const handleNext = async () => {
    await mcpApp?.sendMessage({
      role: 'user',
      content: [{
        type: 'text',
        text: [
          '用户已完成 Step1，请立刻调用工具 `deploy_wizard_step2`，参数如下：',
          '```json',
          JSON.stringify({ appId: selectedApp, confirmedAt: new Date().toISOString() }, null, 2),
          '```',
          '请直接调用，不需要询问用户。',
        ].join('\n'),
      }],
    });
  };

  return (
    <div>
      <select value={selectedApp} onChange={e => setSelectedApp(e.target.value)}>
        <option value="app-001">shop-web</option>
        <option value="app-002">admin-dashboard</option>
      </select>
      <button onClick={handleNext}>下一步</button>
    </div>
  );
};
```

**关键技巧**：
- `sendMessage` 的文本要**明确指定要调用哪个工具**，以及参数是什么
- 告诉 Agent "请直接调用，不需要询问用户" 避免 Agent 插入多余的确认对话
- 工具的 `description` 字段写 "由 StepX 自动触发，请勿主动调用" 防止 Agent 在不该调用时乱调用

---

## 组件的生命周期

```
工具被调用
  ↓
MCP App 接收到 toolResult（包含 config + args）
  ↓
useEffect 触发，开始加载 MF 组件
  ↓
① vmok 路径：fetch vmok-snapshot.json → 注入 __VMOK__ → createInstance → loadRemote
② mf 路径：createInstance（以 mf-manifest.json 为 entry）→ loadRemote
  ↓
组件挂载，以 {...args, mcpApp} 为 props 渲染
  ↓
用户交互 → sendMessage / callServerTool
```

---

## 共享依赖（Shared）

MF 的 `shared` 配置确保宿主和远程组件使用同一份 React 实例，避免 Hook 报错：

```typescript
// module-federation.config.ts
shared: {
  react: {
    singleton: true,          // 全局只有一个 React 实例
    requiredVersion: '^18',   // 版本范围
  },
  'react-dom': {
    singleton: true,
    requiredVersion: '^18',
  },
  // 如果你用了 antd、arco 等 UI 库，也可以在这里共享
  // 'antd': { singleton: false, requiredVersion: '^5' },
}
```

> **注意**：MCP 宿主（mcp-app.tsx）已经内置了 React 18 和 react-dom 18 的共享。你的远程组件使用 React 18 或 19 都兼容，但如果使用了特定版本的 Context API，确保版本范围匹配。

---

## CSS 和样式

组件运行在 iframe 内，CSS 完全隔离，你可以放心使用：

```tsx
// CSS Modules
import styles from './MyComponent.module.css';

// Tailwind（需要在你的项目里配置）
// styled-components / emotion
// 内联样式（最简单）
```

**注意**：不要依赖宿主页面的全局 CSS 变量，iframe 里拿不到。

---

## Troubleshooting

### `mcpApp` 为 `undefined`

- 确认你的组件被 MCP App 渲染（不是在独立页面调试）
- 在独立开发时，给 `mcpApp` 一个 mock：

```tsx
// 开发调试用
const mockMcpApp: McpApp = {
  callServerTool: async ({ name, arguments: args }) => {
    console.log('[Mock] callServerTool:', name, args);
    return { content: [{ type: 'text', text: '{"mock": true}' }] };
  },
  sendMessage: async ({ content }) => {
    console.log('[Mock] sendMessage:', content[0]?.text);
    return {};
  },
};

// 在开发时
<MyComponent mcpApp={mockMcpApp} />
```

### Hook 报错：`Invalid hook call`

React singleton 没有正确配置。确保 `module-federation.config.ts` 里设置了 `react: { singleton: true }`，并且版本范围与宿主匹配（`^18`）。

### 组件内 `fetch` 请求失败（CORS）

在 `mcp_apps.json` 的 `csp.connectDomains` 里添加该域名（带完整协议头），或改用 `mcpApp.callServerTool({ name: 'fetch_remote_resource', ... })` 走 Node.js 代理。
