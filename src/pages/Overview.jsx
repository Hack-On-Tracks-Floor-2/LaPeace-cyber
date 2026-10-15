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

  return (
    <>
      <div className="page-head">
        <h1 className="page-title">
          <span className="prompt">&gt;</span> Security Overview
        </h1>
        <p className="page-sub">Discover vulnerabilities. Generate defenses. Verify repairs.</p>
        <div className="page-actions">
          <button className="btn btn-primary" onClick={() => navigate('assessment')}>
            &gt;&gt; run assessment
          </button>
          <button className="btn" onClick={() => navigate('findings')}>
            !! inspect findings
          </button>
          <button className="btn" onClick={() => navigate('repairs')}>
            ## guardrails
          </button>
        </div>
      </div>

      <div className="stack">
        <Banner tone="info" tag="live status">
          Live red-teaming dashboard connected to backend. Testing trained dataset prompts against target chatbot API.
        </Banner>

        {connection.status === 'disconnected' ? (
          <Banner tone="err" tag="disconnected">
            AEGIS backend unreachable — showing last cached sample.{' '}
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
            sub={<span className="dim">across {distribution.length + 1} assessment runs</span>}
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
                baseline <span className="down">↓ {metrics.asrAfter}%</span> after verified repairs
              </span>
            }
          />
          <MetricCard
            label="Verified Repairs"
            value={loading ? '––' : metrics.verifiedRepairs}
            tone="green"
            sub={<span className="up">of {metrics.repairsAttempted} attempts (sample)</span>}
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
                  run {metrics.lastRun} · <Badge tone="b-sample">SAMPLE</Badge>
                </span>
              }
            >
              <Terminal lines={demo.forceEmpty ? [] : activity.slice(0, 14)} height="mid" empty="no activity recorded" />
            </Panel>

            <Panel title="attack category distribution">
              {demo.forceEmpty ? (
                <EmptyState title="no tests recorded yet">Run an assessment to populate category counts.</EmptyState>
              ) : (
                <>
                  <div className="bar-row" style={{ color: 'var(--text-faint)', fontSize: 10, textTransform: 'uppercase', letterSpacing: 1 }}>
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
                      tone={d.violations > 10 ? 'red' : d.violations > 3 ? 'amber' : ''}
                      display={`${d.tests}`}
                      title={d.label}
                    />
                  ))}
                  <div className="legend" style={{ marginTop: 10 }}>
                    <span>
                      <span className="sw sw-gray" />
                      tests executed
                    </span>
                    <span>
                      <span className="sw sw-amber" />
                      category with violations
                    </span>
                    <span>
                      <span className="sw sw-red" />
                      &gt;10 confirmed violations
                    </span>
                  </div>
                  <div className="small dim" style={{ marginTop: 8 }}>
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
              actions={<Badge tone="b-sample">SAMPLE</Badge>}
            >
              <table className="compare">
                <thead>
                  <tr>
                    <th>metric</th>
                    <th>before repair</th>
                    <th>after repair</th>
                    <th>change</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>tests in campaign</td>
                    <td>{ba.before.tests}</td>
                    <td>{ba.after.tests}</td>
                    <td className="dim">+{ba.after.tests - ba.before.tests}</td>
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
                    <td>false refusal (legit req.)</td>
                    <td>{ba.before.falseRefusal}%</td>
                    <td className="after">{ba.after.falseRefusal}%</td>
                    <td className="dim">+{Math.round((ba.after.falseRefusal - ba.before.falseRefusal) * 10) / 10} pts</td>
                  </tr>
                </tbody>
              </table>
              <div className="small dim" style={{ marginTop: 8 }}>
                Coverage: {metrics.verifiedRepairs} verified repairs of {metrics.repairsAttempted} attempts · unseen
                variants retested per repair.
              </div>
            </Panel>

            <Panel
              title="pipeline status"
              actions={<Badge tone="b-ok">operational</Badge>}
            >
              <div className="kv" style={{ gridTemplateColumns: '150px 1fr' }}>
                <dt>architecture</dt>
                <dd className="arch-line">
                  <b>Frontend → AEGIS Backend → PyRIT → Hosted LLM API</b>
                </dd>
                <dt>orchestrator</dt>
                <dd>PyRIT converters + judges (execution-evidence scoring)</dd>
                <dt>target</dt>
                <dd>
                  {connection.status === 'connected' ? (
                    <span className="text-green">connected · handshake {connection.lastHandshake} · {connection.latencyMs}ms</span>
                  ) : connection.status === 'testing' ? (
                    <span className="text-amber">testing connection to target…</span>
                  ) : (
                    <span className="text-red">disconnected</span>
                  )}
                </dd>
                <dt>data feed</dt>
                <dd>
                  <span className="text-green">LIVE</span> · <code>backend/server.py</code> (dataset: attacker_sft.jsonl)
                </dd>
                <dt>next up</dt>
                <dd className="dim">
                  {findings.filter((f) => f.evidence === 'CONFIRMED' && f.repair === 'NOT STARTED').length} confirmed
                  finding(s) awaiting a defense proposal
                </dd>
              </div>
            </Panel>
          </div>
        ) : null}

        {!loading && !error ? (
          <Panel
            title="recent findings"
            actions={
              <>
                <Badge tone="b-sample">SAMPLE</Badge>
                <button className="btn btn-sm" onClick={() => navigate('findings')}>
                  view all →
                </button>
              </>
            }
            flush
          >
            {demo.forceEmpty ? (
              <EmptyState title="no findings recorded">Findings appear after an assessment confirms a violation.</EmptyState>
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
                      <th>repair status</th>
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
                        <td className="td-strong">{f.attackType}</td>
                        <td>{f.policy}</td>
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
                            {f.repair}
                          </Badge>
                        </td>
                        <td className="ts-cell">{f.ts}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <div className="small dim" style={{ padding: '8px 12px' }}>
              Showing {recent.length} of {metrics.confirmedViolations} confirmed violations. Evidence status is
              derived from execution traces — never from the chatbot's self-report.
            </div>
          </Panel>
        ) : null}
      </div>
    </>
  );
}
