import { Helmet } from '@modern-js/runtime/head';
import './index.css';

const tools = [
  {
    name: 'deploy_wizard_step1',
    title: 'Deploy Wizard',
    desc: 'A 3-step interactive deployment UI — select app, confirm config, watch progress.',
    modules: [
      { path: './DeployWizardStep1', label: 'Select Application' },
      { path: './DeployWizardStep2', label: 'Confirm Configuration' },
      { path: './DeployWizardStep3', label: 'Deployment Progress' },
    ],
  },
];

const Index = () => (
  <div className="page">
    <Helmet>
      <title>MF MCP Provider</title>
    </Helmet>

    <header className="header">
      <div className="header-inner">
        <div className="logo">
          <img src="https://module-federation.io/svg.svg" alt="MF" className="logo-img" />
          <span className="logo-text">Module Federation</span>
        </div>
        <span className="status-badge">● Running on :8080</span>
      </div>
    </header>

    <main className="main">
      <div className="hero">
        <h1 className="hero-title">
          MCP Apps <span className="accent">Demo Provider</span>
        </h1>
        <p className="hero-sub">
          This Module Federation provider exposes interactive UI components as
          MCP Apps for Claude Desktop.
        </p>
      </div>

      <section className="section">
        <h2 className="section-title">Exposed Tools</h2>
        <div className="cards">
          {tools.map(tool => (
            <div className="card" key={tool.name}>
              <div className="card-header">
                <div className="card-icon">🚀</div>
                <div>
                  <div className="card-title">{tool.title}</div>
                  <div className="card-desc">{tool.desc}</div>
                </div>
              </div>
              <div className="card-divider" />
              <div className="card-modules">
                {tool.modules.map((m, i) => (
                  <div className="module-row" key={m.path}>
                    <span className="module-step">{i + 1}</span>
                    <div className="module-info">
                      <span className="module-label">{m.label}</span>
                      <code className="module-path">{m.path}</code>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="section">
        <h2 className="section-title">Connect with Claude Desktop</h2>
        <div className="steps">
          <div className="step">
            <div className="step-num">1</div>
            <div>
              <div className="step-label">Keep this server running</div>
              <code className="code-block">pnpm dev</code>
            </div>
          </div>
          <div className="step">
            <div className="step-num">2</div>
            <div>
              <div className="step-label">Register in claude_desktop_config.json</div>
              <code className="code-block">{`"command": "npx", "args": ["-y", "@module-federation/mcp-apps@latest", "--config", "<path>/mcp_apps.json", "--stdio"]`}</code>
            </div>
          </div>
          <div className="step">
            <div className="step-num">3</div>
            <div>
              <div className="step-label">Ask Claude to start a deployment</div>
              <code className="code-block">Start a deployment</code>
            </div>
          </div>
        </div>
      </section>
    </main>

    <footer className="footer">
      <a href="https://github.com/module-federation/mcp-apps" target="_blank" rel="noreferrer">GitHub</a>
      <span className="sep">·</span>
      <a href="https://modelcontextprotocol.io/docs/extensions/apps" target="_blank" rel="noreferrer">MCP Apps Spec</a>
      <span className="sep">·</span>
      <a href="https://module-federation.io" target="_blank" rel="noreferrer">Module Federation</a>
    </footer>
  </div>
);

export default Index;

