import React from 'react';
import { useApp } from '../state/AppContext.jsx';
import { navigate } from '../router.js';

export default function TopBar() {
  const { connection, toggleConnection, settings, projects, run } = useApp();
  const [project, setProject] = React.useState(projects[0]);

  const connOk = connection.status === 'connected';
  const testing = connection.status === 'testing';
  const targetOk = connection.targetStatus === 'connected';

  return (
    <header className="topbar">
      <div className="topbar-item">
        <span className="k">PROJECT</span>
        <select
          className="project-select"
          value={project}
          onChange={(e) => setProject(e.target.value)}
          aria-label="Project selector"
        >
          {projects.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
      </div>

      <span className="topbar-sep" />

      <div className="topbar-item" title="Target chatbot endpoint status">
        <span className="k">TARGET</span>
        <span className={`led ${targetOk && connOk ? 'led-green' : 'led-red'}`} />
        <span className="v">{connOk && targetOk ? 'Connected' : 'Disconnected'}</span>
      </div>

      <div className="topbar-item" title={`${settings.provider} / ${settings.model}`}>
        <span className="k">MODEL</span>
        <span className="v">
          {settings.provider} / {settings.model}
        </span>
      </div>

      <button
        className="led-btn topbar-item"
        onClick={toggleConnection}
        title={`AEGIS backend API — click to demo the ${connOk ? 'disconnected' : 'connected'} state. Keys stay server-side.`}
      >
        <span className="k">API</span>
        <span className={`led ${testing ? 'led-amber' : connOk ? 'led-green' : 'led-red'}`} />
        <span className="v">{testing ? 'Testing…' : connOk ? 'OK' : 'OFF'}</span>
      </button>

      <div className="topbar-item" title="API keys are held by the AEGIS backend and are never sent to the browser">
        <span className="k">KEY</span>
        <span className="v dim">•••••••• (server-side)</span>
      </div>

      <span
        className="badge"
        style={{
          background: connOk
            ? 'rgba(34, 197, 94, 0.15)'
            : testing
            ? 'rgba(234, 179, 8, 0.15)'
            : 'rgba(239, 68, 68, 0.15)',
          color: connOk
            ? 'var(--green, #4ade80)'
            : testing
            ? 'var(--amber, #facc15)'
            : 'var(--red, #f87171)',
          borderColor: connOk
            ? 'rgba(34, 197, 94, 0.3)'
            : testing
            ? 'rgba(234, 179, 8, 0.3)'
            : 'rgba(239, 68, 68, 0.3)',
        }}
        title={connOk ? 'Connected to live AEGIS backend' : testing ? 'Testing target connection…' : 'Backend offline'}
      >
        {connOk ? 'FEED: LIVE' : testing ? 'FEED: TESTING…' : 'FEED: OFFLINE'}
      </span>

      {run.status === 'running' ? (
        <div className="topbar-item">
          <span className="led led-amber" />
          <span className="v text-amber">RUN {run.progress}%</span>
        </div>
      ) : null}

      <span className="topbar-spacer" />

      <button className="btn btn-primary" onClick={() => navigate('assessment')}>
        + New Assessment
      </button>
    </header>
  );
}
