// Shared UI primitives: panels, badges, terminal, states, tables.
// Small on purpose — every page composes these instead of re-styling.

import React from 'react';
import { severityClass } from '../services/constants.js';
import { useApp } from '../state/AppContext.jsx';

export function Panel({ title, actions, children, flush = false, className = '' }) {
  return (
    <section className={`panel ${className}`}>
      {title || actions ? (
        <div className="panel-hd">
          {title ? <span className="panel-title">{title}</span> : null}
          <span className="spacer" />
          {actions}
        </div>
      ) : null}
      <div className={`panel-bd${flush ? ' flush' : ''}`}>{children}</div>
    </section>
  );
}

export function MetricCard({ label, value, sub, tone }) {
  return (
    <div className="metric">
      <div className="metric-label">{label}</div>
      <div className={`metric-value ${tone || ''}`}>{value}</div>
      <div className="metric-sub">{sub}</div>
    </div>
  );
}

export function SeverityBadge({ severity }) {
  return <span className={`badge ${severityClass(severity)}`}>{severity}</span>;
}

export function Badge({ tone = '', children, title }) {
  return (
    <span className={`badge ${tone}`} title={title}>
      {children}
    </span>
  );
}

export const SAMPLE_BADGE = (
  <span className="badge b-sample" title="Simulated sample data — not a real test outcome">
    SAMPLE DATA
  </span>
);

/** Terminal panel. `lines`: [{ ts, tag|level, msg }], `max` caps rendering. */
export function Terminal({ lines = [], height = 'mid', follow = false, empty = 'no output' }) {
  const endRef = React.useRef(null);
  React.useEffect(() => {
    if (follow && endRef.current) endRef.current.scrollIntoView({ block: 'end' });
  }, [lines.length, follow]);

  if (!lines.length) {
    return (
      <div className={`terminal ${height}`}>
        <div className="state">
          <span className="state-glyph">_</span>
          {empty}
        </div>
      </div>
    );
  }

  return (
    <div className={`terminal ${height}`}>
      {lines.map((l, i) => {
        const level = l.level || 'lvl-info';
        return (
          <div className={`term-line ${level}`} key={i}>
            <span className="ts">{l.ts}</span>
            <span className="tag">[{l.tag || level.replace('lvl-', '').toUpperCase()}]</span>
            <span className={`msg ${msgClass(level)}`}>{l.msg}</span>
          </div>
        );
      })}
      {follow ? <div className="term-line term-cursor" ref={endRef} /> : null}
    </div>
  );
}

function msgClass(level) {
  const map = {
    'lvl-pass': 'msg-pass',
    'lvl-viol': 'msg-viol',
    'lvl-incon': 'msg-incon',
    'lvl-err': 'msg-err',
    'lvl-ok': 'msg-pass',
  };
  return map[level] || '';
}

export function Loading({ rows = 4, label = 'loading…' }) {
  return (
    <div aria-busy="true" aria-label={label}>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className={`skeleton ${['w70', 'w90', 'w40', 'w70'][i % 4]}`} />
      ))}
    </div>
  );
}

export function EmptyState({ glyph = '_', title = 'nothing here', children }) {
  return (
    <div className="state">
      <span className="state-glyph">{glyph}</span>
      <div>{title}</div>
      {children ? <div className="dim" style={{ marginTop: 6 }}>{children}</div> : null}
    </div>
  );
}

export function ErrorState({ message, onRetry }) {
  return (
    <div className="state state-err">
      <span className="state-glyph">[!]</span>
      <div>ERROR — {message}</div>
      {onRetry ? (
        <button className="btn btn-sm mt" onClick={onRetry}>
          retry
        </button>
      ) : null}
    </div>
  );
}

export function DisconnectedState({ onReconnect }) {
  return (
    <div className="state">
      <span className="state-glyph">[x]</span>
      <div className="text-red">DISCONNECTED — AEGIS backend unreachable</div>
      <div className="dim" style={{ marginTop: 6 }}>
        Data shown is the last cached sample. Live assessment is disabled until the connection is restored.
      </div>
      {onReconnect ? (
        <button className="btn btn-sm mt" onClick={onReconnect}>
          reconnect
        </button>
      ) : null}
    </div>
  );
}

export function Banner({ tone = 'warn', tag, children }) {
  return (
    <div className={`banner banner-${tone}`}>
      <span className="banner-tag">{tag}</span>
      <span>{children}</span>
    </div>
  );
}

export function ProgressBar({ value, label }) {
  const v = Math.max(0, Math.min(100, value));
  return (
    <div className="progress-row">
      <div className="progress">
        <div className="fill" style={{ width: `${v}%` }} />
      </div>
      <span className="pct">{label != null ? label : `${v}%`}</span>
    </div>
  );
}

export function Tabs({ tabs, active, onChange }) {
  return (
    <div className="tabs" role="tablist">
      {tabs.map((t) => (
        <button
          key={t.id}
          role="tab"
          aria-selected={active === t.id}
          className={`tab${active === t.id ? ' active' : ''}`}
          onClick={() => onChange(t.id)}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

export function Drawer({ title, subtitle, onClose, children, footer }) {
  React.useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <>
      <div className="overlay" onClick={onClose} />
      <aside className="drawer" role="dialog" aria-modal="true" aria-label={title}>
        <div className="drawer-hd">
          <h2>{title}</h2>
          {subtitle}
          <button className="close" onClick={onClose} aria-label="Close">
            x
          </button>
        </div>
        <div className="drawer-bd">{children}</div>
        {footer ? <div style={{ borderTop: '1px solid var(--border)', padding: '10px 16px' }}>{footer}</div> : null}
      </aside>
    </>
  );
}

export function Modal({ title, onClose, children, footer }) {
  React.useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <>
      <div className="overlay" onClick={onClose} />
      <div className="modal-wrap">
        <div className="modal" role="dialog" aria-modal="true" aria-label={title}>
          <div className="drawer-hd">
            <h2>{title}</h2>
            <button className="close" onClick={onClose} aria-label="Close">
              x
            </button>
          </div>
          <div className="drawer-bd">{children}</div>
          {footer ? <div style={{ borderTop: '1px solid var(--border)', padding: '10px 16px' }}>{footer}</div> : null}
        </div>
      </div>
    </>
  );
}

export function Section({ index, title, children }) {
  return (
    <div className="detail-section">
      <h3>
        <span className="idx">{index}</span>
        {title}
      </h3>
      {children}
    </div>
  );
}

export function KV({ items }) {
  return (
    <dl className="kv">
      {items.map(([k, v]) => (
        <React.Fragment key={k}>
          <dt>{k}</dt>
          <dd>{v}</dd>
        </React.Fragment>
      ))}
    </dl>
  );
}

export function BarRow({ label, value, max, tone = '', display }) {
  const w = max > 0 ? Math.max(2, Math.round((value / max) * 100)) : 0;
  return (
    <div className="bar-row">
      <span className="bar-label" title={label}>
        {label}
      </span>
      <span className="bar-track">
        <span className={`bar-fill ${tone}`} style={{ width: `${w}%` }} />
      </span>
      <span className="bar-val">{display != null ? display : value}</span>
    </div>
  );
}

/** Page-level fetch simulation: latency + error surface for one view. */
export function usePageLoad(deps = []) {
  const { demo } = useApp();
  const [state, setState] = React.useState({ loading: true, error: null });
  const [nonce, setNonce] = React.useState(0);

  React.useEffect(() => {
    let alive = true;
    setState({ loading: true, error: null });
    const t = setTimeout(() => {
      if (!alive) return;
      if (demo.forceError) {
        setState({ loading: false, error: 'AEGIS backend returned 503 (simulated error state)' });
      } else {
        setState({ loading: false, error: null });
      }
    }, 380);
    return () => {
      alive = false;
      clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nonce, demo.forceError, ...deps]);

  return { ...state, retry: () => setNonce((n) => n + 1) };
}

/** Consistent "sample data" strip used by data-bearing panels. */
export function SimulatedNote({ children }) {
  return (
    <div className="small dim" style={{ marginTop: 8 }}>
      <span className="badge b-sample">SIMULATED</span> {children}
    </div>
  );
}
