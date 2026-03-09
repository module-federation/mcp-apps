import React, { useState, useCallback } from 'react';

// ---- Types ----
interface McpApp {
  callServerTool: (params: { name: string; arguments?: Record<string, unknown> }) => Promise<{
    content: Array<{ type: string; text?: string }>;
    isError?: boolean;
  }>;
  sendMessage?: (params: {
    role: string;
    content: Array<{ type: string; text: string }>;
  }) => Promise<{ isError?: boolean }>;
}

export interface DeployWizardStep1Props {
  /** Optional: pre-populated app list (injected from mcp_apps.json inputSchema) */
  apps?: Array<{ id: string; name: string; env: string }>;
  mcpApp?: McpApp;
}

// ---- Mock data ----
const DEFAULT_APPS = [
  { id: 'app-001', name: 'shop-web', env: 'production' },
  { id: 'app-002', name: 'admin-dashboard', env: 'staging' },
  { id: 'app-003', name: 'payment-service', env: 'production' },
];

const ENVIRONMENTS = ['production', 'staging', 'canary'];

// ---- Component ----
const DeployWizardStep1: React.FC<DeployWizardStep1Props> = ({
  apps = DEFAULT_APPS,
  mcpApp,
}) => {
  const [selectedApp, setSelectedApp] = useState<typeof DEFAULT_APPS[0] | null>(null);
  const [selectedEnv, setSelectedEnv] = useState('production');
  const [deployNote, setDeployNote] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const [statusMsg, setStatusMsg] = useState('');

  // User clicks "Confirm & Next"
  // Core flow: collect data -> sendMessage to Agent -> Agent triggers Step 2 with data as props
  const handleNext = useCallback(async () => {
    if (!selectedApp) return;
    if (!mcpApp?.sendMessage) {
      setStatus('error');
      setStatusMsg('mcpApp.sendMessage unavailable — run inside an MCP context');
      return;
    }

    setStatus('loading');
    setStatusMsg('Notifying agent to proceed...');

    // Build the data payload; Agent extracts this and injects it as props into Step 2
    const step1Data = {
      appId: selectedApp.id,
      appName: selectedApp.name,
      env: selectedEnv,
      deployNote: deployNote.trim() || undefined,
      confirmedAt: new Date().toISOString(),
    };

    try {
      const result = await mcpApp.sendMessage({
        role: 'user',
        content: [{
          type: 'text',
          // This message enters the Agent conversation and directs it to call the next tool.
          // The structured data below will be extracted and passed as props to Step 2.
          text: [
            `User has completed Step 1 of the Deploy Wizard. Call tool \`deploy_wizard_step2\` immediately.`,
            ``,
            `Data collected in Step 1 (pass as-is to Step 2):`,
            `\`\`\`json`,
            JSON.stringify(step1Data, null, 2),
            `\`\`\``,
            ``,
            `Call deploy_wizard_step2 directly without asking the user any questions.`,
          ].join('\n'),
        }],
      });

      if (result?.isError) {
        setStatus('error');
        setStatusMsg('Agent rejected the message — check MCP permissions');
      } else {
        setStatus('done');
        setStatusMsg('✅ Agent notified, Step 2 loading...');
      }
    } catch (e: any) {
      setStatus('error');
      setStatusMsg(`❌ Failed to send: ${e.message}`);
    }
  }, [selectedApp, selectedEnv, deployNote, mcpApp]);

  const statusColors: Record<string, string> = {
    idle: 'transparent',
    loading: '#fef3c7',
    done: '#dcfce7',
    error: '#fee2e2',
  };

  return (
    <div style={{
      fontFamily: 'system-ui, -apple-system, sans-serif',
      padding: '20px',
      maxWidth: '480px',
      background: '#ffffff',
      borderRadius: '12px',
      boxShadow: '0 1px 3px rgba(0,0,0,0.12)',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
        <div style={{
          width: '28px', height: '28px', borderRadius: '50%',
          background: '#3b82f6', color: '#fff',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '13px', fontWeight: 700, flexShrink: 0,
        }}>1</div>
        <div>
          <h2 style={{ margin: 0, fontSize: '15px', color: '#111827', fontWeight: 600 }}>
            Deploy Wizard · Step 1
          </h2>
          <p style={{ margin: 0, fontSize: '12px', color: '#6b7280' }}>
            Select application and environment
          </p>
        </div>
        {/* Step indicator */}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: '4px' }}>
          {[1, 2, 3].map(n => (
            <div key={n} style={{
              width: '8px', height: '8px', borderRadius: '50%',
              background: n === 1 ? '#3b82f6' : '#e5e7eb',
            }} />
          ))}
        </div>
      </div>

      {/* App selection */}
      <div style={{ marginBottom: '16px' }}>
        <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: '#374151', marginBottom: '6px' }}>
          Application *
        </label>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {apps.map(app => (
            <div
              key={app.id}
              onClick={() => setSelectedApp(app)}
              style={{
                padding: '10px 12px',
                border: `2px solid ${selectedApp?.id === app.id ? '#3b82f6' : '#e5e7eb'}`,
                borderRadius: '8px',
                cursor: 'pointer',
                background: selectedApp?.id === app.id ? '#eff6ff' : '#fff',
                transition: 'all 0.15s',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <div style={{
                width: '8px', height: '8px', borderRadius: '50%',
                background: selectedApp?.id === app.id ? '#3b82f6' : '#d1d5db',
                flexShrink: 0,
              }} />
              <div>
                <div style={{ fontSize: '13px', fontWeight: 500, color: '#111827' }}>{app.name}</div>
                <div style={{ fontSize: '11px', color: '#6b7280' }}>ID: {app.id}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Environment selection */}
      <div style={{ marginBottom: '16px' }}>
        <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: '#374151', marginBottom: '6px' }}>
          Environment *
        </label>
        <div style={{ display: 'flex', gap: '8px' }}>
          {ENVIRONMENTS.map(env => (
            <button
              key={env}
              onClick={() => setSelectedEnv(env)}
              style={{
                padding: '6px 14px',
                fontSize: '12px',
                border: `2px solid ${selectedEnv === env ? '#3b82f6' : '#e5e7eb'}`,
                borderRadius: '6px',
                cursor: 'pointer',
                background: selectedEnv === env ? '#eff6ff' : '#fff',
                color: selectedEnv === env ? '#3b82f6' : '#374151',
                fontWeight: selectedEnv === env ? 600 : 400,
                transition: 'all 0.15s',
              }}
            >
              {env}
            </button>
          ))}
        </div>
      </div>

      {/* Deploy note */}
      <div style={{ marginBottom: '20px' }}>
        <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: '#374151', marginBottom: '6px' }}>
          Deploy note (optional)
        </label>
        <textarea
          value={deployNote}
          onChange={e => setDeployNote(e.target.value)}
          placeholder="e.g. Fix login bug, hotfix v1.2.3"
          rows={2}
          style={{
            width: '100%',
            padding: '8px 10px',
            fontSize: '12px',
            border: '1px solid #e5e7eb',
            borderRadius: '6px',
            resize: 'vertical',
            color: '#111827',
            boxSizing: 'border-box',
            outline: 'none',
            fontFamily: 'inherit',
          }}
        />
      </div>

      {/* Status bar */}
      {status !== 'idle' && (
        <div style={{
          padding: '8px 12px',
          borderRadius: '6px',
          background: statusColors[status],
          fontSize: '12px',
          color: '#374151',
          marginBottom: '12px',
        }}>
          {status === 'loading' && <span>⏳ </span>}
          {statusMsg}
        </div>
      )}

      {/* CTA Button */}
      <button
        onClick={handleNext}
        disabled={!selectedApp || status === 'loading' || status === 'done'}
        style={{
          width: '100%',
          padding: '10px',
          fontSize: '14px',
          fontWeight: 600,
          background: !selectedApp || status === 'loading' || status === 'done'
            ? '#d1d5db'
            : '#3b82f6',
          color: '#fff',
          border: 'none',
          borderRadius: '8px',
          cursor: !selectedApp || status === 'loading' || status === 'done'
            ? 'not-allowed'
            : 'pointer',
          transition: 'background 0.15s',
        }}
      >
        {status === 'loading' ? '⏳ Notifying agent...' : status === 'done' ? '✅ Done, waiting for Step 2...' : 'Next →'}
      </button>

      {/* Debug: mcpApp status */}
      <div style={{ marginTop: '12px', fontSize: '11px', color: '#9ca3af', textAlign: 'center' }}>
        mcpApp:{' '}
        <span style={{ color: mcpApp ? '#16a34a' : '#dc2626' }}>
          {mcpApp ? '✅ injected' : '❌ missing'}
        </span>
        {selectedApp && (
          <span style={{ marginLeft: '8px' }}>
            · Selected: <strong style={{ color: '#374151' }}>{selectedApp.name}</strong> / {selectedEnv}
          </span>
        )}
      </div>
    </div>
  );
};

export default DeployWizardStep1;
