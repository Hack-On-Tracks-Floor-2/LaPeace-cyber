import React from 'react';
import { useApp } from '../state/AppContext.jsx';
import { navigate } from '../router.js';
import { Panel, Badge, Banner, Modal, Terminal, EmptyState, ProgressBar, Section } from '../components/ui.jsx';
import { REPAIR_STAGES } from '../services/constants.js';
import { pct } from '../services/reportStats.js';

function StageChain({ stage, failed, compact = false }) {
  return (
    <div className="chain" role="list" aria-label="Repair workflow">
      {REPAIR_STAGES.map((label, i) => {
        let cls = '';
        if (i < stage) cls = 'done';
        if (i === stage) cls = failed ? 'failed' : 'current';
        if (i === stage && stage === 5 && !failed) cls = 'done';
        return (
          <div className={`chain-step ${cls}`} role="listitem" key={label}>
            <span className="step-no">{i + 1}</span>
            <span>{compact ? label.replace('Confirmed Finding', 'Finding').replace('Proposed Defense', 'Defense').replace('Regression Test', 'Regression') : label}</span>
            {i < stage || (i === stage && stage === 5 && !failed) ? <span className="spacer" /> : null}
            {i < stage || (i === stage && stage === 5 && !failed) ? <span>✓</span> : null}
            {i === stage && failed ? <span className="spacer" /> : null}
            {i === stage && failed ? <span className="text-red">✗</span> : null}
            {i === stage && !failed && stage !== 5 ? <span className="spacer" /> : null}
            {i === stage && !failed && stage !== 5 ? <span className="text-amber">●</span> : null}
          </div>
        );
      })}
    </div>
  );
}

function stageLabel(r) {
  if (r.failed && r.stage === 4) return 'REGRESSION FAILED';
  if (r.stage >= 5) return 'VERIFIED REPAIR';
  if (r.regressionRunning) return 'REGRESSION RUNNING';
  return REPAIR_STAGES[r.stage].toUpperCase();
}

export default function Guardrails({ param }) {
  const { repairs, findings, applyToSandbox, runRegression, demo } = useApp();
  const [preview, setPreview] = React.useState(null);
  const [compare, setCompare] = React.useState(null);
  const [busy, setBusy] = React.useState({});

  const list = demo.forceEmpty ? [] : repairs;
  const linked = param ? repairs.find((r) => r.id === param) : null;

  const busySet = (id, action) => setBusy((b) => ({ ...b, [id]: action }));

  const onSandbox = async (id) => {
    busySet(id, 'sandbox');
    try {
      await applyToSandbox(id);
    } finally {
      busySet(id, null);
    }
  };

  const onRegression = async (id) => {
    busySet(id, 'regression');
    try {
      await runRegression(id);
    } finally {
      busySet(id, null);
    }
  };

  return (
    <>
      <div className="page-head">
        <h1 className="page-title">
          <span className="prompt">&gt;</span> Guardrails &amp; Repairs
        </h1>
        <p className="page-sub">
          From confirmed finding to verified repair — defenses are proven in an isolated sandbox before anything else.
        </p>
      </div>

      <div className="stack">
        <Panel title="repair workflow">
          <StageChain stage={2} failed={false} />
          <div className="flex" style={{ marginTop: 10 }}>
            <span className="small dim">
              Each repair moves through the same chain; stage markers reflect the selected repair below.
            </span>
            <span className="spacer" />
            <Badge tone="b-warn">SANDBOX ONLY</Badge>
          </div>
        </Panel>

        <Banner tone="info" tag="isolation">
          Repairs are applied to <b>sandbox aegis-sbx-07</b> — an isolated copy of the target configuration. The
          production chatbot is never modified by this screen.
        </Banner>

        {list.length === 0 ? (
          <Panel title="repairs">
            <EmptyState title="no repairs yet">
              Open a confirmed finding in Findings and press Generate Fix to stage a defense proposal here.
            </EmptyState>
          </Panel>
        ) : (
          list.map((r) => {
            const finding = findings.find((f) => f.id === r.findingId);
            const b = busy[r.id];
            const inSandbox = r.stage >= 3;
            const canRunRegression = r.stage >= 3 && !b && !r.regressionRunning && r.stage < 5;
            const canCompare = r.after != null;

            return (
              <Panel
                key={r.id}
                title={`${r.id} · repair`}
                className={linked && linked.id === r.id ? '' : ''}
                actions={
                  <>
                    <Badge tone={r.failed ? 'b-err' : r.stage >= 5 ? 'b-ok' : 'b-warn'}>{stageLabel(r)}</Badge>
                    <button className="btn btn-sm" onClick={() => navigate(`findings/${r.findingId}`)}>
                      {r.findingId} ↗
                    </button>
                  </>
                }
              >
                <div className="flex" style={{ marginBottom: 10 }}>
                  <strong style={{ fontSize: 13 }}>{r.title}</strong>
                  <span className="dim small">created {r.createdAt}</span>
                  {r.generated ? <Badge tone="b-ghost">GENERATED</Badge> : null}
                </div>

                <StageChain stage={r.stage} failed={r.failed} compact />

                <div className="grid grid-2 mt">
                  <div>
                    <Section index="01" title="Original vulnerability">
                      <p style={{ margin: 0, fontSize: 12 }}>{r.vulnerability}</p>
                    </Section>
                    <Section index="02" title="Proposed guardrail / code change">
                      <pre className="codeblock">{r.change.diff}</pre>
                      <div className="small dim" style={{ marginTop: 6 }}>
                        target: <span className="text-green">{r.change.target}</span>
                      </div>
                    </Section>
                    <Section index="03" title="Why this defense">
                      <p style={{ margin: 0, fontSize: 12, color: 'var(--text-dim)' }}>{r.rationale}</p>
                      <p style={{ margin: '8px 0 0', fontSize: 12 }}>
                        <span className="lbl">root cause</span>
                        <br />
                        {r.rootCause}
                      </p>
                    </Section>
                  </div>

                  <div>
                    <Section index="04" title="Before vs after (sandbox)">
                      <table className="compare">
                        <thead>
                          <tr>
                            <th>metric</th>
                            <th>before</th>
                            <th>after</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr>
                            <td>tests</td>
                            <td>{r.before.tests}</td>
                            <td>{r.after ? r.after.tests : <span className="dim">not run</span>}</td>
                          </tr>
                          <tr>
                            <td>violations</td>
                            <td className="before">{r.before.violations}</td>
                            <td className={r.after ? (r.after.violations ? 'before' : 'after') : ''}>
                              {r.after ? r.after.violations : '—'}
                            </td>
                          </tr>
                          <tr>
                            <td>attack success rate</td>
                            <td className="before">{r.before.asr}%</td>
                            <td className={r.after ? (r.after.asr ? 'before' : 'after') : ''}>
                              {r.after ? `${r.after.asr}%` : '—'}
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </Section>

                    <Section index="05" title="Unseen attack variants &amp; false refusals">
                      {r.unseen ? (
                        <div className="flex" style={{ gap: 8 }}>
                          <Badge tone={r.unseen.escaped === 0 ? 'b-ok' : 'b-err'}>
                            unseen: {r.unseen.blocked}/{r.unseen.variants} blocked
                          </Badge>
                          <Badge tone={r.falseRefusal.rate <= 2 ? 'b-ok' : 'b-warn'}>
                            legit blocked: {r.falseRefusal.blocked}/{r.falseRefusal.tested} ({r.falseRefusal.rate}%)
                          </Badge>
                        </div>
                      ) : (
                        <div className="small dim">
                          not measured yet — {r.stage < 3 ? 'apply to sandbox first' : 'run regression tests'}.
                        </div>
                      )}
                      {r.regressionRunning ? (
                        <div style={{ marginTop: 8 }}>
                          <ProgressBar value={66} label="running…" />
                        </div>
                      ) : null}
                    </Section>

                    <Section index="06" title="Remaining risks">
                      <p
                        style={{ margin: 0, fontSize: 12 }}
                        className={r.failed ? 'text-red' : r.after ? 'text-amber' : 'dim'}
                      >
                        {r.remainingRisk}
                      </p>
                    </Section>
                  </div>
                </div>

                <div className="mt">
                  <div className="lbl" style={{ marginBottom: 6 }}>
                    repair log
                  </div>
                  <Terminal lines={r.logs} height="short" empty="no repair events yet" />
                </div>

                <div className="flex mt">
                  <button className="btn" onClick={() => setPreview(r)}>
                    Preview Fix
                  </button>
                  <button
                    className="btn btn-primary"
                    onClick={() => onSandbox(r.id)}
                    disabled={!!b || inSandbox || r.stage < 2}
                    title={inSandbox ? 'Already applied to the sandbox' : 'Apply to the isolated sandbox environment'}
                  >
                    {b === 'sandbox' ? 'applying…' : inSandbox ? '✓ Applied to Sandbox' : 'Apply to Sandbox'}
                  </button>
                  <button
                    className="btn btn-amber"
                    onClick={() => onRegression(r.id)}
                    disabled={!canRunRegression}
                    title={r.stage < 3 ? 'Apply to sandbox first' : r.stage >= 5 ? 'Already verified' : 'Run unseen-variant + legitimate-request suite'}
                  >
                    {b === 'regression' || r.regressionRunning ? 'regression running…' : 'Run Regression Tests'}
                  </button>
                  <button className="btn" onClick={() => setCompare(r)} disabled={!canCompare} title={canCompare ? '' : 'Run regression tests first'}>
                    Compare Results
                  </button>
                  <span className="spacer" />
                  <span className="small dim">sandbox: aegis-sbx-07 · production: untouched</span>
                </div>
              </Panel>
            );
          })
        )}
      </div>

      {preview ? (
        <Modal
          title={`preview fix — ${preview.id}`}
          onClose={() => setPreview(null)}
          footer={
            <div className="flex">
              <button className="btn" onClick={() => setPreview(null)}>
                close
              </button>
              <span className="small dim">changes are staged for the sandbox only</span>
            </div>
          }
        >
          <Section index="A" title="Change target">
            <pre className="codeblock">{preview.change.target}</pre>
          </Section>
          <Section index="B" title="Proposed diff">
            <pre className="codeblock">{preview.change.diff}</pre>
          </Section>
          <Section index="C" title="Reason for selecting this defense">
            <p style={{ margin: 0, fontSize: 12 }}>{preview.rationale}</p>
          </Section>
          <Section index="D" title="Root cause addressed">
            <p style={{ margin: 0, fontSize: 12 }}>{preview.rootCause}</p>
          </Section>
        </Modal>
      ) : null}

      {compare ? (
        <Modal
          title={`compare results — ${compare.id}`}
          onClose={() => setCompare(null)}
          footer={
            <div className="flex">
              <button className="btn" onClick={() => setCompare(null)}>
                close
              </button>
              <span className="small dim">
                repair success: {compare.after && compare.after.violations === 0 ? 'verified' : compare.failed ? 'failed' : 'partial'}
              </span>
            </div>
          }
        >
          <table className="compare">
            <thead>
              <tr>
                <th>metric</th>
                <th>before repair</th>
                <th>after repair</th>
                <th>delta</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>violations / 10 tests</td>
                <td className="before">{compare.before.violations}</td>
                <td className="after">{compare.after.violations}</td>
                <td className="after">{compare.after.violations - compare.before.violations}</td>
              </tr>
              <tr>
                <td>attack success rate</td>
                <td className="before">{compare.before.asr}%</td>
                <td className="after">{compare.after.asr}%</td>
                <td className="after">{pct(compare.after.asr - compare.before.asr, 100)}%</td>
              </tr>
              <tr>
                <td>unseen variants blocked</td>
                <td className="dim">n/a</td>
                <td className={compare.unseen.escaped === 0 ? 'after' : 'before'}>
                  {compare.unseen.blocked}/{compare.unseen.variants}
                </td>
                <td className="dim">{compare.unseen.escaped} escaped</td>
              </tr>
              <tr>
                <td>false refusals (legit)</td>
                <td className="dim">n/a</td>
                <td className={compare.falseRefusal.rate <= 2 ? 'after' : 'before'}>
                  {compare.falseRefusal.rate}% ({compare.falseRefusal.blocked}/{compare.falseRefusal.tested})
                </td>
                <td className="dim">measured on legit sample</td>
              </tr>
            </tbody>
          </table>

          <div className="mt">
            <div className="lbl">attack success rate</div>
            <div className="bar-row">
              <span className="bar-label">before</span>
              <span className="bar-track">
                <span className="bar-fill red" style={{ width: `${Math.min(100, compare.before.asr)}%` }} />
              </span>
              <span className="bar-val">{compare.before.asr}%</span>
            </div>
            <div className="bar-row">
              <span className="bar-label">after</span>
              <span className="bar-track">
                <span className="bar-fill" style={{ width: `${Math.min(100, compare.after.asr)}%` }} />
              </span>
              <span className="bar-val">{compare.after.asr}%</span>
            </div>
          </div>

          <div className="mt">
            <Section index="R" title="Remaining risks after this repair">
              <p style={{ margin: 0, fontSize: 12 }} className={compare.failed ? 'text-red' : 'text-amber'}>
                {compare.remainingRisk}
              </p>
            </Section>
          </div>
        </Modal>
      ) : null}
    </>
  );
}
