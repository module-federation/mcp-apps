import React from 'react';
import './ProviderComponent.css';

const Provider: React.FC = () => {
  return (
    <div className="container">
      <span className="badge">MCP Apps</span>
      <h1 className="title">Module Federation</h1>
      <p className="subtitle">Render micro-frontend components as interactive AI Agent UIs</p>
      <div className="version-tag">v2.0</div>
    </div>
  );
};

export default Provider;
