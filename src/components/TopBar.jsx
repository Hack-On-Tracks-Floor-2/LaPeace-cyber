import React from 'react';
import { useApp } from '../state/AppContext.jsx';
import { navigate } from '../router.js';

export default function TopBar() {
  const { connection, settings, projects, run } = useApp();
  const [project, setProject] = React.useState(projects[0]);

  const connOk = connection.status === 'connected';
  const targetOk = connection.targetStatus === 'connected';

  return (
    <header className="topbar">
      <div className="topbar-item">
        <span className="k">PROJECT:</span>
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
        <span className="k">TARGET:</span>
        <span className={`led ${targetOk && connOk ? 'led-green' : 'led-red'}`} />
        <span className="v">{connOk && targetOk ? 'Connected' : 'Disconnected'}</span>
      </div>

      <div className="topbar-item" title={`${settings.provider} / ${settings.model}`}>
        <span className="k">MODEL:</span>
        <span className="v">
          {settings.provider} / {settings.model}
        </span>
      </div>

      <span className="topbar-sep" />

      <div className="topbar-item" title="Active Safety Evaluator & Shield">
        <span className="k">GUARDRAIL:</span>
        <span className="badge b-cyan" style={{ fontSize: '11px', letterSpacing: '0.5px' }}>
          🛡️ LLAMA GUARD 8B
        </span>
      </div>

      {run.status === 'running' ? (
        <div className="topbar-item">
          <span className="led led-amber" />
          <span className="v text-amber font-bold">RUN {run.progress}%</span>
        </div>
      ) : null}

      <span className="topbar-spacer" />

      <button className="btn btn-primary" onClick={() => navigate('assessment')}>
        + New Assessment
      </button>
    </header>
  );
}
