import React from 'react';
import { useApp } from '../state/AppContext.jsx';
import { navigate } from '../router.js';
import {
  Panel,
  MetricCard,
  Terminal,
  Badge,
  SeverityBadge,
  Loading,
  EmptyState,
  ErrorState,
  Banner,
  BarRow,
  usePageLoad,
} from '../components/ui.jsx';
import { severityCounts, attackSuccessRate } from '../services/reportStats.js';

export default function Overview() {
  const { metrics, activity, distribution, beforeAfter, findings, connection, demo, toggleConnection } = useApp();
  const { loading, error, retry } = usePageLoad();

  const sev = severityCounts(findings);
  const recent = findings.slice(0, 6);
  const maxTests = Math.max(...distribution.map((d) => d.tests), 1);
  const ba = beforeAfter;
  const hasRunData = metrics.testsExecuted > 0 || findings.length > 0;

  return (
    <>
      <div className="page-head">
        <h1 className="page-title">
          <span className="prompt">&gt;</span> Security Overview
        </h1>
        <p className="page-sub">
          Live red-teaming telemetry, Llama Guard 8B defense metrics, and verified repairs for the current assessment dataset.
        </p>
        <div className="page-actions">
          <button className="btn btn-primary" onClick={() => navigate('assessment')}>
            &gt;&gt; run assessment
          </button>
          <button className="btn" onClick={() => navigate('findings')}>
            !! inspect findings
          </button>
          <button className="btn" onClick={() => navigate('repairs')}>
            🛡️ llama guard 8b defenses
          </button>
        </div>
      </div>

      <div className="stack">
        {connection.status === 'disconnected' ? (
          <Banner tone="err" tag="disconnected">
            AEGIS backend unreachable — check backend server connection.{' '}
            <button className="btn btn-sm" onClick={toggleConnection}>
              reconnect
            </button>
          </Banner>
        ) : null}

        {error ? <ErrorState message={error} onRetry={retry} /> : null}

        <div className="grid grid-4">
          <MetricCard
            label="Tests Executed"
            value={loading ? '–––' : metrics.testsExecuted.toLocaleString()}
            sub={<span className="dim">in current assessment campaign</span>}
          />
          <MetricCard
            label="Confirmed Violations"
            value={loading ? '––' : metrics.confirmedViolations}
            tone="red"
            sub={<span className="warn">{sev.CRITICAL} critical · {sev.HIGH} high in current list</span>}
          />
          <MetricCard
            label="Attack Success Rate"
            value={loading ? '––' : `${metrics.asrBefore}%`}
            tone="amber"
            sub={
              <span className="dim">
                baseline <span className="down">↓ {metrics.asrAfter}%</span> with Llama Guard 8B
              </span>
            }
          />
          <MetricCard
            label="Verified Repairs"
            value={loading ? '––' : metrics.verifiedRepairs}
            tone="green"
            sub={<span className="up">of {metrics.repairsAttempted} attempts (human-approved)</span>}
          />
        </div>

        {loading ? (
          <Panel title="loading overview">
            <Loading rows={5} />
          </Panel>
        ) : (
          <div className="grid grid-2">
            <Panel
              title="recent assessment activity"
              actions={
                <span className="small dim">
                  run {metrics.lastRun} · <span className="text-green">LIVE</span>
                </span>
              }
            >
              <Terminal lines={demo.forceEmpty ? [] : activity.slice(0, 14)} height="mid" empty="no activity recorded yet — run an assessment to start" />
            </Panel>

            <Panel title="attack category distribution">
              {demo.forceEmpty || distribution.length === 0 ? (
                <EmptyState title="no tests recorded in current campaign">
                  Run an assessment to populate category distribution from the trained dataset.
                </EmptyState>
              ) : (
                <>
                  <div className="bar-row" style={{ color: 'var(--text-faint)', fontSize: 11, textTransform: 'uppercase', letterSpacing: 1, fontWeight: 700 }}>
                    <span>category</span>
                    <span>tests executed</span>
                    <span style={{ textAlign: 'right' }}>viol.</span>
                  </div>
                  {distribution.map((d) => (
                    <BarRow
                      key={d.label}
                      label={d.label}
                      value={d.tests}
                      max={maxTests}
                      tone={d.violations > 5 ? 'red' : d.violations > 0 ? 'amber' : ''}
                      display={`${d.tests}`}
                      title={d.label}
                    />
                  ))}
                  <div className="legend" style={{ marginTop: 12 }}>
                    <span>
                      <span className="sw sw-gray" />
                      tests executed
                    </span>
                    <span>
                      <span className="sw sw-amber" />
                      violations detected
                    </span>
                    <span>
                      <span className="sw sw-red" />
                      critical attack category
                    </span>
                  </div>
                  <div className="small dim" style={{ marginTop: 10 }}>
                    attack success rate per category:{' '}
                    {distribution.map((d) => `${d.label.split(' ')[0]} ${attackSuccessRate(d.tests, d.violations)}%`).join(' · ')}
                  </div>
                </>
              )}
            </Panel>
          </div>
        )}

        {!loading && !error ? (
          <div className="grid grid-2">
            <Panel
              title="before vs after repair"
              actions={<span className="badge b-cyan">SHIELD: LLAMA GUARD 8B</span>}
            >
              {hasRunData ? (
                <table className="compare">
                  <thead>
                    <tr>
                      <th>metric</th>
                      <th>before defense</th>
                      <th>after defense</th>
                      <th>change</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>tests in campaign</td>
                      <td>{ba.before.tests}</td>
                      <td>{ba.after.tests}</td>
                      <td className="dim">0</td>
                    </tr>
                    <tr>
                      <td>confirmed violations</td>
                      <td className="before">{ba.before.violations}</td>
                      <td className="after">{ba.after.violations}</td>
                      <td className="after">−{ba.before.violations - ba.after.violations}</td>
                    </tr>
                    <tr>
                      <td>attack success rate</td>
                      <td className="before">{ba.before.asr}%</td>
                      <td className="after">{ba.after.asr}%</td>
                      <td className="after">−{Math.round((ba.before.asr - ba.after.asr) * 10) / 10} pts</td>
                    </tr>
                    <tr>
                      <td>guardrail defense layer</td>
                      <td className="dim">none (unshielded)</td>
                      <td className="after">Llama Guard 8B</td>
                      <td className="after">active</td>
                    </tr>
                  </tbody>
                </table>
              ) : (
                <EmptyState title="no repair comparison yet">
                  Run an assessment to compare attack success rates before and after Llama Guard 8B guardrails.
                </EmptyState>
              )}
              <div className="small dim" style={{ marginTop: 10 }}>
                Coverage: {metrics.verifiedRepairs} human-approved defenses of {metrics.repairsAttempted} synthesized.
              </div>
            </Panel>

            <Panel
              title="pipeline status"
              actions={<Badge tone="b-ok">operational</Badge>}
            >
              <div className="kv" style={{ gridTemplateColumns: '160px 1fr' }}>
                <dt>architecture</dt>
                <dd className="arch-line">
                  <b>Frontend → AEGIS Backend → Llama Guard 8B → Target API</b>
                </dd>
                <dt>safety shield</dt>
                <dd>
                  <span className="badge b-cyan">Meta Llama Guard 3 8B</span> (Taxonomy S1–S13)
                </dd>
                <dt>target chatbot</dt>
                <dd>
                  {connection.status === 'connected' ? (
                    <span className="text-green">connected · {connection.latencyMs || 120}ms latency</span>
                  ) : connection.status === 'testing' ? (
                    <span className="text-amber">testing connection to target…</span>
                  ) : (
                    <span className="text-red">disconnected</span>
                  )}
                </dd>
                <dt>data feed</dt>
                <dd>
                  <span className="text-green">LIVE</span> · <code>backend/server.py</code> (5,611 trained prompts)
                </dd>
                <dt>next action</dt>
                <dd className="dim">
                  {findings.filter((f) => f.evidence === 'CONFIRMED' && f.repair !== 'VERIFIED').length} confirmed
                  finding(s) awaiting verified human approval
                </dd>
              </div>
            </Panel>
          </div>
        ) : null}

        {!loading && !error ? (
          <Panel
            title="recent findings"
            actions={
              <button className="btn btn-sm" onClick={() => navigate('findings')}>
                view all →
              </button>
            }
            flush
          >
            {recent.length === 0 ? (
              <EmptyState title="no findings in current campaign">
                Findings will appear dynamically after an assessment run detects policy violations.
              </EmptyState>
            ) : (
              <div className="tbl-wrap">
                <table className="tbl">
                  <thead>
                    <tr>
                      <th>finding id</th>
                      <th>severity</th>
                      <th>attack category</th>
                      <th>policy violated</th>
                      <th>evidence</th>
                      <th>guardrail status</th>
                      <th>timestamp</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recent.map((f) => (
                      <tr key={f.id} className="clickable" onClick={() => navigate(`findings/${f.id}`)}>
                        <td className="id-cell">{f.id}</td>
                        <td>
                          <SeverityBadge severity={f.severity} />
                        </td>
                        <td className="td-strong">
                          {f.attackType}
                          {f.chain && f.chain.length > 2 ? (
                            <span className="badge b-cyan" style={{ marginLeft: 6, fontSize: 10 }}>
                              CoT ({f.chain.length / 2} turns)
                            </span>
                          ) : null}
                        </td>
                        <td className="dim">{f.policy}</td>
                        <td>
                          <Badge tone={f.evidence === 'CONFIRMED' ? 'b-err' : f.evidence === 'PENDING' ? 'b-warn' : 'b-ghost'}>
                            {f.evidence}
                          </Badge>
                        </td>
                        <td>
                          <Badge
                            tone={
                              f.repair === 'VERIFIED'
                                ? 'b-ok'
                                : f.repair === 'FAILED'
                                  ? 'b-err'
                                  : f.repair === 'NOT STARTED'
                                    ? 'b-ghost'
                                    : 'b-warn'
                            }
                          >
                            {f.guardrailStatus === 'APPROVED' ? '✓ APPROVED' : f.repair}
                          </Badge>
                        </td>
                        <td className="ts-cell">{f.ts}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <div className="small dim" style={{ padding: '10px 14px' }}>
              Showing {recent.length} of {metrics.confirmedViolations} confirmed violations from current run.
            </div>
          </Panel>
        ) : null}
      </div>
    </>
  );
}
