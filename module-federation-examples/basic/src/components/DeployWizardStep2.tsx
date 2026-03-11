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

// Data structure passed from Step 1 (Agent extracts and injects as props)
export interface DeployWizardStep2Props {
  /** From Step 1: application ID */
  appId?: string;
  /** From Step 1: application name */
  appName?: string;
  /** From Step 1: deployment environment */
  env?: string;
  /** From Step 1: deploy note */
  deployNote?: string;
  /** From Step 1: confirmation timestamp */
  confirmedAt?: string;
  /** Injected by MCP host */
  mcpApp?: McpApp;
}

// ---- Sub-components ----
function InfoRow({ label, value, highlight }: { label: string; value?: string; highlight?: boolean }) {
  if (!value) return null;
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid #f3f4f6' }}>
      <span style={{ fontSize: '12px', color: '#6b7280' }}>{label}</span>
      <span style={{ fontSize: '12px', fontWeight: highlight ? 600 : 400, color: highlight ? '#111827' : '#374151' }}>{value}</span>
    </div>
  );
}

const ENV_COLOR: Record<string, string> = {
  production: '#dc2626',
  staging: '#d97706',
  canary: '#7c3aed',
};

// ---- Component ----
const DeployWizardStep2: React.FC<DeployWizardStep2Props> = ({
  appId,
  appName,
  env = 'production',
  deployNote,
  confirmedAt,
  mcpApp,
}) => {
  const [deployTag, setDeployTag] = useState('');
  const [rollbackEnabled, setRollbackEnabled] = useState(true);
  const [notifySlack, setNotifySlack] = useState(true);
  const [confirmInput, setConfirmInput] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const [statusMsg, setStatusMsg] = useState('');

  // Validate Step 1 data is present (proves the multi-step chain worked)
  const hasStep1Data = Boolean(appId && appName && env);

  // For production: require user to type the app name to unlock the deploy button
  const isProduction = env === 'production';
  const productionConfirmed = !isProduction || confirmInput === appName;

  // User confirms deploy → sendMessage/postMessage triggers Step 3
  const handleConfirmDeploy = useCallback(async () => {
    if (!mcpApp && window.parent === window) {
      setStatus('error');
      setStatusMsg('No messaging channel available');
      return;
    }

    setStatus('loading');
    setStatusMsg('Submitting deployment...');

    const step2Data = {
      // Data forwarded from Step 1
      appId,
      appName,
      env,
      deployNote,
      // New config added in Step 2
      deployTag: deployTag.trim() || 'latest',
      rollbackEnabled,
      notifySlack,
      submittedAt: new Date().toISOString(),
    };

    const msgText = `[Deploy Wizard] Step 2 done → call deploy_wizard_step3(appId="${appId}", appName="${appName}", env="${env}", deployTag="${step2Data.deployTag}", rollbackEnabled=${step2Data.rollbackEnabled}, notifySlack=${step2Data.notifySlack}, confirmedAt="${confirmedAt ?? ''}", submittedAt="${step2Data.submittedAt}"${deployNote ? `, deployNote="${deployNote}"` : ''})`;

    try {
      // Dual-channel: both use same compact text; AI PAAS hidden (not shown in UI), Claude Desktop visible
      if (window.parent !== window) {
        window.parent.postMessage({
          type: 'mcp-ui-message',
          role: 'user',
          content: { type: 'hidden', text: msgText },
        }, '*');
      }

      if (mcpApp?.sendMessage) {
        const result = await mcpApp.sendMessage({
          role: 'user',
          content: [{ type: 'text', text: msgText }],
        });
        if (result?.isError) {
          setStatus('error');
          setStatusMsg('Agent rejected the message');
          return;
        }
      }

      setStatus('done');
      setStatusMsg('✅ Deployment submitted, Step 3 loading...');
    } catch (e: any) {
      setStatus('error');
      setStatusMsg(`❌ ${e.message}`);
    }
  }, [appId, appName, env, deployNote, deployTag, rollbackEnabled, notifySlack, mcpApp]);

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
          background: '#10b981', color: '#fff',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '13px', fontWeight: 700, flexShrink: 0,
        }}>2</div>
        <div>
          <h2 style={{ margin: 0, fontSize: '15px', color: '#111827', fontWeight: 600 }}>
            Deploy Wizard · Step 2
          </h2>
          <p style={{ margin: 0, fontSize: '12px', color: '#6b7280' }}>
            Confirm deployment configuration
          </p>
        </div>
        {/* Step indicator */}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: '4px' }}>
          {[1, 2, 3].map(n => (
            <div key={n} style={{
              width: '8px', height: '8px', borderRadius: '50%',
              background: n <= 2 ? (n === 2 ? '#10b981' : '#3b82f6') : '#e5e7eb',
            }} />
          ))}
        </div>
      </div>

      {/* Step 1 data — proves cross-step data passing works */}
      <div style={{
        background: hasStep1Data ? '#f0fdf4' : '#fff7ed',
        border: `1px solid ${hasStep1Data ? '#bbf7d0' : '#fed7aa'}`,
        borderRadius: '8px',
        padding: '12px',
        marginBottom: '16px',
      }}>
        <div style={{ fontSize: '12px', fontWeight: 600, color: hasStep1Data ? '#15803d' : '#c2410c', marginBottom: '8px' }}>
          {hasStep1Data ? '✅ Data from Step 1 (passed by Agent)' : '⚠️ No Step 1 data received (called directly)'}
        </div>
        {hasStep1Data ? (
          <div>
            <InfoRow label="Application" value={appName} highlight />
            <InfoRow label="App ID" value={appId} />
            <InfoRow label="Environment" value={env} />
            <InfoRow label="Deploy note" value={deployNote} />
            <InfoRow label="Step 1 confirmed at" value={confirmedAt ? new Date(confirmedAt).toLocaleString() : undefined} />
          </div>
        ) : (
          <div style={{ fontSize: '11px', color: '#9a3412' }}>
            Complete Step 1 via deploy_wizard_step1 first. The Agent will automatically pass the data here.
          </div>
        )}
        {/* Environment badge */}
        {env && (
          <div style={{ marginTop: '8px' }}>
            <span style={{
              display: 'inline-block',
              padding: '2px 8px',
              borderRadius: '9999px',
              fontSize: '11px',
              fontWeight: 600,
              background: `${ENV_COLOR[env] || '#6b7280'}20`,
              color: ENV_COLOR[env] || '#6b7280',
            }}>
              {env.toUpperCase()}
            </span>
          </div>
        )}
      </div>

      {/* Step 2 configuration */}
      <div style={{ marginBottom: '16px' }}>
        <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: '#374151', marginBottom: '6px' }}>
          Deploy version tag
        </label>
        <input
          type="text"
          value={deployTag}
          onChange={e => setDeployTag(e.target.value)}
          placeholder="e.g. v1.2.3 or leave blank to use latest"
          style={{
            width: '100%',
            padding: '8px 10px',
            fontSize: '12px',
            border: '1px solid #e5e7eb',
            borderRadius: '6px',
            color: '#111827',
            background: '#ffffff',
            boxSizing: 'border-box',
            outline: 'none',
            fontFamily: 'inherit',
          }}
        />
      </div>

      {/* Toggle options */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '20px' }}>
        {[
          { label: 'Auto rollback', desc: 'Automatically roll back to the previous version on failure', value: rollbackEnabled, onChange: setRollbackEnabled },
          { label: 'Notify Slack', desc: 'Send a Slack notification when deployment completes', value: notifySlack, onChange: setNotifySlack },
        ].map(({ label, desc, value, onChange }) => (
          <div
            key={label}
            onClick={() => onChange(!value)}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '10px 12px',
              border: '1px solid #e5e7eb',
              borderRadius: '8px',
              cursor: 'pointer',
              background: value ? '#f0fdf4' : '#fff',
            }}
          >
            <div>
              <div style={{ fontSize: '13px', fontWeight: 500, color: '#111827' }}>{label}</div>
              <div style={{ fontSize: '11px', color: '#6b7280' }}>{desc}</div>
            </div>
            {/* Toggle switch */}
            <div style={{
              width: '36px', height: '20px',
              borderRadius: '9999px',
              background: value ? '#10b981' : '#d1d5db',
              position: 'relative',
              transition: 'background 0.2s',
              flexShrink: 0,
            }}>
              <div style={{
                width: '16px', height: '16px',
                borderRadius: '50%',
                background: '#fff',
                position: 'absolute',
                top: '2px',
                left: value ? '18px' : '2px',
                transition: 'left 0.2s',
                boxShadow: '0 1px 2px rgba(0,0,0,0.2)',
              }} />
            </div>
          </div>
        ))}
      </div>

      {/* Production safety gate: type app name to confirm */}
      {isProduction && (
        <div style={{
          background: '#fff1f2',
          border: '1px solid #fecdd3',
          borderRadius: '8px',
          padding: '12px',
          marginBottom: '16px',
        }}>
          <div style={{ fontSize: '12px', fontWeight: 600, color: '#be123c', marginBottom: '6px' }}>
            ⚠️ You are deploying to <strong>production</strong>. This action cannot be undone.
          </div>
          <div style={{ fontSize: '12px', color: '#9f1239', marginBottom: '8px' }}>
            Type <strong style={{ fontFamily: 'monospace', background: '#ffe4e6', padding: '1px 4px', borderRadius: '3px' }}>{appName || 'the app name'}</strong> to confirm.
          </div>
          <input
            type="text"
            value={confirmInput}
            onChange={e => setConfirmInput(e.target.value)}
            placeholder={appName || 'app name'}
            style={{
              width: '100%',
              padding: '8px 10px',
              fontSize: '12px',
              border: `1px solid ${confirmInput && confirmInput !== appName ? '#fca5a5' : confirmInput === appName ? '#86efac' : '#e5e7eb'}`,
              borderRadius: '6px',
              color: '#111827',
              background: '#ffffff',
              boxSizing: 'border-box',
              outline: 'none',
              fontFamily: 'monospace',
            }}
          />
        </div>
      )}

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

      {/* CTA */}
      <button
        onClick={handleConfirmDeploy}
        disabled={!productionConfirmed || status === 'loading' || status === 'done'}
        style={{
          width: '100%',
          padding: '10px',
          fontSize: '14px',
          fontWeight: 600,
          background: !productionConfirmed || status === 'loading' || status === 'done' ? '#d1d5db' : '#10b981',
          color: '#fff',
          border: 'none',
          borderRadius: '8px',
          cursor: !productionConfirmed || status === 'loading' || status === 'done' ? 'not-allowed' : 'pointer',
          transition: 'background 0.15s',
        }}
      >
        {status === 'loading' ? '⏳ Submitting...' : status === 'done' ? '✅ Submitted' : '🚀 Confirm deploy'}
      </button>

      {/* Debug */}
      <div style={{ marginTop: '12px', fontSize: '11px', color: '#9ca3af', textAlign: 'center' }}>
        mcpApp:{' '}
        <span style={{ color: mcpApp ? '#16a34a' : '#dc2626' }}>
          {mcpApp ? '✅ injected' : '❌ missing'}
        </span>
      </div>
    </div>
  );
};

export default DeployWizardStep2;
