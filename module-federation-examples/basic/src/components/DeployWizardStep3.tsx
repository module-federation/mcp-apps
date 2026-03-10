import React, { useState, useEffect, useCallback } from 'react';

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

// Receives all data accumulated from Step 1 + Step 2
export interface DeployWizardStep3Props {
  // From Step1
  appId?: string;
  appName?: string;
  env?: string;
  deployNote?: string;
  confirmedAt?: string;
  // From Step2
  deployTag?: string;
  rollbackEnabled?: boolean;
  notifySlack?: boolean;
  submittedAt?: string;
  // Injected by MCP host
  mcpApp?: McpApp;
}

// ---- Deploy stages ----
interface DeployStage {
  id: string;
  label: string;
  duration: number; // ms
}

const DEPLOY_STAGES: DeployStage[] = [
  { id: 'build',  label: 'Build image',       duration: 2000 },
  { id: 'test',   label: 'Run tests',          duration: 1500 },
  { id: 'push',   label: 'Push to registry',   duration: 1200 },
  { id: 'deploy', label: 'Deploy to cluster',  duration: 2500 },
  { id: 'verify', label: 'Health check',       duration: 1000 },
];

type StageStatus = 'waiting' | 'running' | 'done' | 'error';

interface StageState {
  status: StageStatus;
  startedAt?: number;
  finishedAt?: number;
}

const ENV_COLOR: Record<string, string> = {
  production: '#dc2626',
  staging: '#d97706',
  canary: '#7c3aed',
};

// ---- Component ----
const DeployWizardStep3: React.FC<DeployWizardStep3Props> = ({
  appId,
  appName,
  env = 'production',
  deployNote,
  confirmedAt,
  deployTag = 'latest',
  rollbackEnabled = true,
  notifySlack = true,
  submittedAt,
  mcpApp,
}) => {
  const [stages, setStages] = useState<Record<string, StageState>>(
    () => Object.fromEntries(DEPLOY_STAGES.map(s => [s.id, { status: 'waiting' as StageStatus }]))
  );
  const [currentStageIdx, setCurrentStageIdx] = useState(-1);
  const [isStarted, setIsStarted] = useState(false);
  const [isFinished, setIsFinished] = useState(false);
  const [hasFailed, setHasFailed] = useState(false);
  const [reportSent, setReportSent] = useState(false);

  const hasFullData = Boolean(appId && appName && submittedAt);

  // Simulate deploy progress
  const startDeploy = useCallback(async () => {
    if (isStarted) return;
    setIsStarted(true);

    for (let i = 0; i < DEPLOY_STAGES.length; i++) {
      const stage = DEPLOY_STAGES[i];
      setCurrentStageIdx(i);
      setStages(prev => ({
        ...prev,
        [stage.id]: { status: 'running', startedAt: Date.now() },
      }));
      await new Promise(resolve => setTimeout(resolve, stage.duration));
      setStages(prev => ({
        ...prev,
        [stage.id]: { ...prev[stage.id], status: 'done', finishedAt: Date.now() },
      }));
    }

    setIsFinished(true);
    setCurrentStageIdx(DEPLOY_STAGES.length);
  }, [isStarted]);

  // After deploy finishes, auto-notify Agent with full report (dual-channel)
  useEffect(() => {
    if (!isFinished || reportSent) return;
    const canPostMessage = window.parent !== window;
    const sendMessage = mcpApp?.sendMessage;
    const canSendMessage = Boolean(sendMessage);
    if (!canPostMessage && !canSendMessage) return;
    setReportSent(true);

    const totalTime = DEPLOY_STAGES.reduce((acc, s) => acc + s.duration, 0);

    const messageText = [
      `Deployment of **${appName}** to **${env}** is complete (tag: ${deployTag}).`,
      `Please give the user a brief text summary of the result. Do NOT call any tools.`,
      ``,
      `Deploy report:`,
      `- App: ${appName} (${appId})`,
      `- Environment: ${env}`,
      `- Version tag: ${deployTag}`,
      `- Auto rollback: ${rollbackEnabled ? 'enabled' : 'disabled'}`,
      `- Slack notify: ${notifySlack ? 'enabled' : 'disabled'}`,
      `- Deploy note: ${deployNote || '(none)'}`,
      `- Total duration: ${(totalTime / 1000).toFixed(1)}s`,
      `- Status: ${hasFailed ? '❌ FAILED' : '✅ SUCCESS'}`,
    ].join('\n');

    // postMessage → AI PAAS (hidden: not shown in UI, Agent gives a text summary only)
    if (canPostMessage) {
      window.parent.postMessage(
        { type: 'mcp-ui-message', role: 'user', content: { type: 'hidden', text: messageText } },
        '*'
      );
    }
    if (canSendMessage) {
      try {
        sendMessage!({
          role: 'user',
          content: [{ type: 'text', text: messageText }],
        }).catch(console.error);
      } catch (e) {
        console.warn('[Step3] sendMessage threw synchronously (expected in AI PAAS):', e);
      }
    }
  }, [isFinished, reportSent, hasFailed, mcpApp, appId, appName, env, deployTag, deployNote, rollbackEnabled, notifySlack]);

  // Stage status icon
  const stageIcon = (status: StageStatus) => {
    if (status === 'waiting') return <span style={{ color: '#9ca3af' }}>○</span>;
    if (status === 'running') return <span style={{ animation: 'spin 1s linear infinite', display: 'inline-block' }}>⟳</span>;
    if (status === 'done') return <span style={{ color: '#10b981' }}>✓</span>;
    return <span style={{ color: '#ef4444' }}>✗</span>;
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
      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
      `}</style>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
        <div style={{
          width: '28px', height: '28px', borderRadius: '50%',
          background: isFinished ? '#10b981' : '#f59e0b', color: '#fff',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '13px', fontWeight: 700, flexShrink: 0,
        }}>
          {isFinished ? '✓' : '3'}
        </div>
        <div>
          <h2 style={{ margin: 0, fontSize: '15px', color: '#111827', fontWeight: 600 }}>
            Deploy Wizard · Step 3
          </h2>
          <p style={{ margin: 0, fontSize: '12px', color: '#6b7280' }}>
            {isFinished ? 'Deployment complete 🎉' : isStarted ? 'Deploying...' : 'Waiting to start'}
          </p>
        </div>
        {/* Step indicator */}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: '4px' }}>
          {[1, 2, 3].map(n => (
            <div key={n} style={{
              width: '8px', height: '8px', borderRadius: '50%',
              background: n === 1 ? '#3b82f6' : n === 2 ? '#10b981' : (isFinished ? '#10b981' : '#f59e0b'),
            }} />
          ))}
        </div>
      </div>

      {/* Config summary — data from Step 1 + Step 2 */}
      <div style={{
        background: hasFullData ? '#f0fdf4' : '#fff7ed',
        border: `1px solid ${hasFullData ? '#bbf7d0' : '#fed7aa'}`,
        borderRadius: '8px',
        padding: '12px',
        marginBottom: '16px',
        fontSize: '12px',
      }}>
        <div style={{ fontWeight: 600, color: hasFullData ? '#15803d' : '#c2410c', marginBottom: '8px' }}>
          {hasFullData ? '✅ Full deploy config (from Step 1 + Step 2)' : '⚠️ Incomplete data (full flow not followed)'}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 16px' }}>
          {[
            ['App', appName],
            ['Environment', env],
            ['Version tag', deployTag],
            ['Auto rollback', rollbackEnabled ? '✅ On' : '❌ Off'],
            ['Slack notify', notifySlack ? '✅ On' : '❌ Off'],
            ['Deploy note', deployNote || '(none)'],
          ].map(([label, value]) => (
            <div key={label}>
              <span style={{ color: '#6b7280' }}>{label}: </span>
              <span style={{ color: '#111827', fontWeight: 500 }}>{value}</span>
            </div>
          ))}
        </div>
        {env && (
          <div style={{ marginTop: '8px' }}>
            <span style={{
              display: 'inline-block', padding: '2px 8px', borderRadius: '9999px',
              fontSize: '11px', fontWeight: 600,
              background: `${ENV_COLOR[env] || '#6b7280'}20`,
              color: ENV_COLOR[env] || '#6b7280',
            }}>
              {env.toUpperCase()}
            </span>
          </div>
        )}
      </div>

      {/* Deploy stages */}
      <div style={{
        border: '1px solid #e5e7eb',
        borderRadius: '8px',
        overflow: 'hidden',
        marginBottom: '16px',
      }}>
        {DEPLOY_STAGES.map((stage, idx) => {
          const stageState = stages[stage.id];
          const isRunning = stageState.status === 'running';
          return (
            <div key={stage.id} style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '10px 14px',
              background: isRunning ? '#fffbeb' : stageState.status === 'done' ? '#f0fdf4' : '#fff',
              borderBottom: idx < DEPLOY_STAGES.length - 1 ? '1px solid #f3f4f6' : 'none',
              transition: 'background 0.3s',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ fontSize: '16px', width: '20px', textAlign: 'center' }}>
                  {stageIcon(stageState.status)}
                </div>
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 500, color: '#111827' }}>{stage.label}</div>
                  {isRunning && (
                    <div style={{ fontSize: '11px', color: '#d97706', animation: 'pulse 1.5s ease-in-out infinite' }}>
                      Running...
                    </div>
                  )}
                  {stageState.status === 'done' && stageState.startedAt && stageState.finishedAt && (
                    <div style={{ fontSize: '11px', color: '#6b7280' }}>
                      {((stageState.finishedAt - stageState.startedAt) / 1000).toFixed(1)}s
                    </div>
                  )}
                </div>
              </div>
              {/* Progress bar for running stage */}
              {isRunning && (
                <div style={{
                  width: '60px', height: '4px',
                  background: '#e5e7eb',
                  borderRadius: '9999px',
                  overflow: 'hidden',
                }}>
                  <div style={{
                    height: '100%',
                    background: '#f59e0b',
                    borderRadius: '9999px',
                    animation: 'indeterminate 1.5s ease-in-out infinite',
                    width: '60%',
                  }} />
                </div>
              )}
              {stageState.status === 'waiting' && idx > currentStageIdx && (
                <span style={{ fontSize: '11px', color: '#9ca3af' }}>Waiting</span>
              )}
            </div>
          );
        })}
      </div>

      {/* Success banner */}
      {isFinished && (
        <div style={{
          padding: '12px',
          background: '#dcfce7',
          border: '1px solid #bbf7d0',
          borderRadius: '8px',
          marginBottom: '16px',
          textAlign: 'center',
        }}>
          <div style={{ fontSize: '24px', marginBottom: '4px' }}>🎉</div>
          <div style={{ fontSize: '14px', fontWeight: 600, color: '#15803d' }}>
            {appName} successfully deployed to {env}!
          </div>
          <div style={{ fontSize: '12px', color: '#166534', marginTop: '4px' }}>
            Deploy report sent to Agent. Check the conversation for a summary.
          </div>
        </div>
      )}

      {/* Start/status button */}
      {!isStarted && (
        <button
          onClick={startDeploy}
          style={{
            width: '100%',
            padding: '10px',
            fontSize: '14px',
            fontWeight: 600,
            background: '#f59e0b',
            color: '#fff',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
          }}
        >
          🚀 Start deploy
        </button>
      )}

      {isStarted && !isFinished && (
        <div style={{
          textAlign: 'center',
          padding: '10px',
          fontSize: '13px',
          color: '#d97706',
          background: '#fffbeb',
          borderRadius: '8px',
          animation: 'pulse 1.5s ease-in-out infinite',
        }}>
          ⏳ Deployment in progress, please wait...
        </div>
      )}

      {/* Debug */}
      <div style={{ marginTop: '12px', fontSize: '11px', color: '#9ca3af', textAlign: 'center' }}>
        mcpApp:{' '}
        <span style={{ color: mcpApp ? '#16a34a' : '#dc2626' }}>
          {mcpApp ? '✅ injected' : '❌ missing'}
        </span>
        {isFinished && (
          <span style={{ marginLeft: '8px', color: reportSent ? '#16a34a' : '#d97706' }}>
            · report: {reportSent ? '✅ sent' : '⏳ sending'}
          </span>
        )}
      </div>
    </div>
  );
};

export default DeployWizardStep3;
