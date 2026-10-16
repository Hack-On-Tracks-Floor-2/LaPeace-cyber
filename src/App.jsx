import React from 'react';
import { useRoute } from './router.js';
import { useApp } from './state/AppContext.jsx';
import Sidebar from './components/Sidebar.jsx';
import TopBar from './components/TopBar.jsx';
import Overview from './pages/Overview.jsx';
import RunAssessment from './pages/RunAssessment.jsx';
import AttackLibrary from './pages/AttackLibrary.jsx';
import Findings from './pages/Findings.jsx';
import Guardrails from './pages/Guardrails.jsx';
import Reports from './pages/Reports.jsx';
import Settings from './pages/Settings.jsx';

const PAGES = {
  overview: Overview,
  assessment: RunAssessment,
  library: AttackLibrary,
  findings: Findings,
  repairs: Guardrails,
  reports: Reports,
  settings: Settings,
};

function BootScreen({ error, onRetry }) {
  return (
    <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}>
      <div style={{ width: 460, maxWidth: '92vw' }}>
        <div className="terminal mid" style={{ height: 'auto', padding: '10px 0' }}>
          <div className="term-line lvl-sys">
            <span className="ts">--:--:--</span>
            <span className="tag">[AEGIS]</span>
            <span className="msg">boot // AI Red Teaming &amp; Guardrail Generation</span>
          </div>
          <div className="term-line lvl-info">
            <span className="ts">--:--:--</span>
            <span className="tag">[ARCH]</span>
            <span className="msg">Frontend → AEGIS Backend → PyRIT → Hosted LLM API</span>
          </div>
          {error ? (
            <div className="term-line lvl-viol">
              <span className="ts">--:--:--</span>
              <span className="tag">[ERR]</span>
              <span className="msg">{error}</span>
            </div>
          ) : (
            <div className="term-line lvl-pass term-cursor">
              <span className="ts">--:--:--</span>
              <span className="tag">[CONN]</span>
              <span className="msg">connecting to AEGIS backend…</span>
            </div>
          )}
        </div>
        {error ? (
          <div style={{ marginTop: 12, textAlign: 'center' }}>
            <button className="btn btn-primary" onClick={onRetry}>
              retry connection
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default function App() {
  const { boot, retryBoot } = useApp();
  const { route, param } = useRoute();

  if (boot.status === 'loading') return <BootScreen />;
  if (boot.status === 'error') return <BootScreen error={boot.error} onRetry={retryBoot} />;

  const Page = PAGES[route] || Overview;

  return (
    <div className="app">
      <Sidebar route={route} />
      <div className="main">
        <TopBar />
        <main className="content" key={route + (param || '')}>
          <Page param={param} />
        </main>
      </div>
    </div>
  );
}
