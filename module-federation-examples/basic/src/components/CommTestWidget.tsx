import React, { useState, useCallback } from 'react';

interface CommTestWidgetProps {
  // Props passed from mcp_apps.json inputSchema
  initialMessage?: string;
  // mcpApp is injected by module-federation-mcp host
  mcpApp?: {
    callServerTool: (params: { name: string; arguments?: Record<string, unknown> }) => Promise<{
      content: Array<{ type: string; text?: string }>;
      isError?: boolean;
    }>;
    sendMessage?: (params: {
      role: string;
      content: Array<{ type: string; text: string }>;
    }) => Promise<{ isError?: boolean }>;
  };
}

const CommTestWidget: React.FC<CommTestWidgetProps> = ({ initialMessage = 'Hello from MF!', mcpApp }) => {
  const [log, setLog] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const addLog = (msg: string) => {
    const ts = new Date().toLocaleTimeString();
    setLog(prev => [`[${ts}] ${msg}`, ...prev].slice(0, 20));
  };

  // Test 1: Call a server tool
  const handleCallTool = useCallback(async () => {
    if (!mcpApp) {
      addLog('❌ mcpApp not available (not running in MCP context)');
      return;
    }
    setLoading(true);
    addLog('📡 Calling fetch_remote_resource via mcpApp.callServerTool...');
    try {
      const result = await mcpApp.callServerTool({
        name: 'fetch_remote_resource',
        arguments: {
          url: 'https://httpbin.org/json',
          method: 'GET',
        },
      });
      if (result.isError) {
        addLog(`❌ Tool returned error: ${result.content[0]?.text}`);
      } else {
        addLog(`✅ Tool call succeeded! Response length: ${result.content[0]?.text?.length ?? 0} chars`);
      }
    } catch (e: any) {
      addLog(`❌ callServerTool threw: ${e.message}`);
    } finally {
      setLoading(false);
    }
  }, [mcpApp]);

  // Test 2: Send a message to the agent
  const handleSendMessage = useCallback(async () => {
    if (!mcpApp?.sendMessage) {
      addLog('❌ mcpApp.sendMessage not available');
      return;
    }
    setLoading(true);
    addLog('💬 Sending message to agent via mcpApp.sendMessage...');
    try {
      const result = await mcpApp.sendMessage({
        role: 'user',
        content: [{ type: 'text', text: '我从 MF 组件内部发送了一条消息！请回复 "收到"。' }],
      });
      if (result.isError) {
        addLog('❌ Agent rejected the message');
      } else {
        addLog('✅ Message sent to agent successfully!');
      }
    } catch (e: any) {
      addLog(`❌ sendMessage threw: ${e.message}`);
    } finally {
      setLoading(false);
    }
  }, [mcpApp]);

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', padding: '16px', maxWidth: '480px' }}>
      <h2 style={{ fontSize: '16px', margin: '0 0 8px', color: '#1a1a1a' }}>
        🔌 MCP Communication Test
      </h2>
      <p style={{ fontSize: '12px', color: '#666', margin: '0 0 12px' }}>
        initialMessage: <strong>{initialMessage}</strong>
        {' · '}
        mcpApp: <strong style={{ color: mcpApp ? '#16a34a' : '#dc2626' }}>
          {mcpApp ? '✅ injected' : '❌ missing'}
        </strong>
      </p>

      <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', flexWrap: 'wrap' }}>
        <button
          onClick={handleCallTool}
          disabled={loading}
          style={{
            padding: '6px 12px', fontSize: '12px', cursor: loading ? 'not-allowed' : 'pointer',
            background: '#3b82f6', color: '#fff', border: 'none', borderRadius: '4px',
            opacity: loading ? 0.6 : 1,
          }}
        >
          {loading ? '⏳' : '📡'} callServerTool
        </button>
        <button
          onClick={handleSendMessage}
          disabled={loading}
          style={{
            padding: '6px 12px', fontSize: '12px', cursor: loading ? 'not-allowed' : 'pointer',
            background: '#8b5cf6', color: '#fff', border: 'none', borderRadius: '4px',
            opacity: loading ? 0.6 : 1,
          }}
        >
          {loading ? '⏳' : '💬'} sendMessage
        </button>
        <button
          onClick={() => setLog([])}
          style={{
            padding: '6px 12px', fontSize: '12px', cursor: 'pointer',
            background: '#e5e7eb', color: '#374151', border: 'none', borderRadius: '4px',
          }}
        >
          🗑 Clear
        </button>
      </div>

      <div style={{
        background: '#0f172a', borderRadius: '6px', padding: '10px',
        minHeight: '120px', maxHeight: '240px', overflowY: 'auto',
        fontSize: '11px', color: '#94a3b8', fontFamily: 'monospace',
      }}>
        {log.length === 0
          ? <span style={{ color: '#475569' }}>Click a button to test communication...</span>
          : log.map((l, i) => <div key={i}>{l}</div>)
        }
      </div>
    </div>
  );
};

export default CommTestWidget;
