import React from 'react';
import { useApp } from '../state/AppContext.jsx';
import { navigate } from '../router.js';
import { remainingVulnerabilities } from '../services/reportStats.js';

const ITEMS = [
  { id: 'overview', glyph: '::', label: 'Overview' },
  { id: 'assessment', glyph: '>>', label: 'Run Assessment' },
  { id: 'library', glyph: '[]', label: 'Attack Library' },
  { id: 'findings', glyph: '!!', label: 'Findings' },
  { id: 'repairs', glyph: '##', label: 'Guardrails & Repairs' },
  { id: 'reports', glyph: '//', label: 'Reports' },
  { id: 'settings', glyph: '==', label: 'Settings' },
];

export default function Sidebar({ route }) {
  const { findings, run, connection } = useApp();
  const openCount = remainingVulnerabilities(findings).length;
  const connOk = connection?.status === 'connected';

  return (
    <aside className="sidebar">
      <div className="sidebar-head">
        <span className="logo-mark">A</span>
        <span>
          <span className="logo-text">AEGIS</span>
          <span className="logo-sub">RED TEAM OPS</span>
        </span>
      </div>

      <nav className="nav" aria-label="Primary">
        <div className="nav-section">Assessment</div>
        {ITEMS.slice(0, 4).map((item) => (
          <NavItem key={item.id} item={item} route={route} badge={item.id === 'findings' ? openCount : item.id === 'assessment' && run.status === 'running' ? 'LIVE' : null} />
        ))}
        <div className="nav-section">Remediation</div>
        {ITEMS.slice(4).map((item) => (
          <NavItem key={item.id} item={item} route={route} />
        ))}
      </nav>

      <div className="sidebar-foot">
        AEGIS v0.4.2-hack
        <br />
        <span className="arch-line">
          <b>FE → AEGIS → PyRIT → LLM</b>
        </span>
        <br />
        <span className={connOk ? 'text-green' : connection?.status === 'testing' ? 'text-amber' : 'text-red'}>
          {connOk ? 'FEED: LIVE' : connection?.status === 'testing' ? 'FEED: TESTING…' : 'FEED: OFFLINE'}
        </span>
      </div>
    </aside>
  );
}

function NavItem({ item, route, badge }) {
  const active = route === item.id;
  return (
    <button
      className={`nav-item${active ? ' active' : ''}`}
      onClick={() => navigate(item.id)}
      title={item.label}
      aria-current={active ? 'page' : undefined}
    >
      <span className="nav-ico">{item.glyph}</span>
      <span>{item.label}</span>
      {badge ? <span className="nav-badge">{badge}</span> : null}
    </button>
  );
}
