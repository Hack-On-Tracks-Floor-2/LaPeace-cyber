import React from 'react';
import { useApp } from '../state/AppContext.jsx';
import { navigate } from '../router.js';
import {
  Panel,
  Badge,
  SeverityBadge,
  Drawer,
  Section,
  KV,
  Banner,
  Loading,
  EmptyState,
  ErrorState,
  ProgressBar,
  usePageLoad,
} from '../components/ui.jsx';

const EVIDENCE_TONE = { CONFIRMED: 'b-err', PENDING: 'b-warn', INCONCLUSIVE: 'b-ghost' };
const REPAIR_TONE = {
  VERIFIED: 'b-ok',
  'IN PROGRESS': 'b-warn',
  PROPOSED: 'b-warn',
  'NOT STARTED': 'b-ghost',
  FAILED: 'b-err',
};

function generateDocHTML(findings, settings) {
  const dateStr = new Date().toLocaleString();
  const rows = findings
    .map(
      (f, idx) => `
    <div style="border: 1px solid #333; margin-bottom: 24px; padding: 16px; font-family: Arial, sans-serif;">
      <h3 style="margin-top: 0; color: #b91c1c;">Finding #${idx + 1}: ${f.id} — ${f.severity}</h3>
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 12px;" border="1" cellpadding="6">
        <tr style="background: #f3f4f6;"><td><b>Attack Type</b></td><td>${f.attackType || 'General Safety'}</td></tr>
        <tr><td><b>Severity</b></td><td><b>${f.severity}</b></td></tr>
        <tr style="background: #f3f4f6;"><td><b>Policy</b></td><td>${f.policy || 'Safety Policy'}</td></tr>
        <tr><td><b>Confidence</b></td><td>${f.confidence || 85}%</td></tr>
        <tr style="background: #f3f4f6;"><td><b>Llama Guard 8B Shield</b></td><td>${f.guardrailId ? `${f.guardrailId} (${f.guardrailStatus || 'PENDING_APPROVAL'})` : 'Staged'}</td></tr>
      </table>

      ${
        f.chain && f.chain.length > 0
          ? `<h4 style="color: #0369a1; margin-bottom: 6px;">Chain of Thought Attack & Conversation Trace:</h4>
             ${f.chain
               .map(
                 (c) => `
               <div style="background: ${c.role === 'user' ? '#f0fdf4' : '#f0f9ff'}; border-left: 4px solid ${c.role === 'user' ? '#16a34a' : '#0284c7'}; padding: 8px 12px; margin-bottom: 8px;">
                 <b>Turn ${c.turn || 1} [${c.role === 'user' ? 'USER / ATTACKER' : 'ASSISTANT / TARGET'}]</b>
                 <pre style="white-space: pre-wrap; font-family: Consolas, monospace; font-size: 11px; margin: 4px 0 0;">${escapeHtml(c.content)}</pre>
               </div>`
               )
               .join('')}`
          : `<h4 style="margin-bottom: 4px;">Attack Prompt:</h4>
             <pre style="background: #fef2f2; padding: 10px; border-left: 4px solid #ef4444; white-space: pre-wrap;">${escapeHtml(f.attackInput)}</pre>
             <h4 style="margin-bottom: 4px;">Observed Response:</h4>
             <pre style="background: #f8fafc; padding: 10px; border-left: 4px solid #64748b; white-space: pre-wrap;">${escapeHtml(f.response)}</pre>`
      }

      ${
        f.extractedItems && f.extractedItems.length > 0
          ? `<h4 style="color: #b91c1c; margin-bottom: 6px;">Exfiltrated Intelligence & Secrets:</h4>
             <table style="width: 100%; border-collapse: collapse; margin-bottom: 12px;" border="1" cellpadding="6">
               <tr style="background: #fef2f2;"><th>Type</th><th>Extracted Value</th><th>Snippet</th></tr>
               ${f.extractedItems
                 .map(
                   (it) => `<tr><td><b>${escapeHtml(it.type)}</b></td><td><code>${escapeHtml(it.value)}</code></td><td>${escapeHtml(it.snippet || '')}</td></tr>`
                 )
                 .join('')}
             </table>`
          : ''
      }

      <h4 style="margin-bottom: 4px; color: #475569;">Evidence & Root Cause:</h4>
      <p style="margin: 4px 0;"><b>Root Cause:</b> ${f.rootCause || 'Alignment bypass'}</p>
      <p style="margin: 4px 0;"><b>Recommended Llama Guard 8B Defense:</b> ${f.defense || 'Input hazard classification'}</p>
    </div>
  `
    )
    .join('');

  return `
    <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
    <head><meta charset='utf-8'><title>AEGIS Assessment Findings</title></head>
    <body style="font-family: Arial, sans-serif; padding: 20px;">
      <h1 style="color: #0f172a; border-bottom: 2px solid #0284c7; padding-bottom: 8px;">AEGIS — Security Assessment Findings Report</h1>
      <p><b>Date:</b> ${dateStr} | <b>Target:</b> ${settings?.provider || 'LLM API'} (${settings?.model || 'Target Model'})</p>
      <p><b>Total Findings:</b> ${findings.length} | <b>Shield Engine:</b> Meta Llama Guard 3 8B</p>
      <hr style="margin: 16px 0;" />
      ${rows}
    </body>
    </html>
  `;
}

function escapeHtml(str) {
  return (str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export default function Findings({ param }) {
  const { findings, generateFix, repairs, demo, settings, approveGuardrailAction, rejectGuardrailAction } = useApp();
  const { loading, error, retry } = usePageLoad();

  const [q, setQ] = React.useState('');
  const [severity, setSeverity] = React.useState('ALL');
  const [evidence, setEvidence] = React.useState('ALL');
  const [repair, setRepair] = React.useState('ALL');
  const [busyFix, setBusyFix] = React.useState(false);
  const [busyApproval, setBusyApproval] = React.useState(false);
  const [fixNote, setFixNote] = React.useState(null);

  const filtered = React.useMemo(() => {
    if (demo.forceEmpty) return [];
    const needle = q.trim().toLowerCase();
    return findings.filter(
      (f) =>
        (!needle ||
          f.id.toLowerCase().includes(needle) ||
          f.attackType.toLowerCase().includes(needle) ||
          f.policy.toLowerCase().includes(needle)) &&
        (severity === 'ALL' || f.severity === severity) &&
        (evidence === 'ALL' || f.evidence === evidence) &&
        (repair === 'ALL' || f.repair === repair)
    );
  }, [findings, q, severity, evidence, repair, demo.forceEmpty]);

  const selected = param ? findings.find((f) => f.id === param) : null;
  const linkedRepair = selected?.repairId ? repairs.find((r) => r.id === selected.repairId) : null;
  const hasFilters = q || severity !== 'ALL' || evidence !== 'ALL' || repair !== 'ALL';

  const confirmed = findings.filter((f) => f.evidence === 'CONFIRMED').length;
  const openConfirmed = findings.filter((f) => f.evidence === 'CONFIRMED' && f.repair !== 'VERIFIED').length;

  const onExportPDF = () => {
    window.print();
  };

  const onExportDOC = () => {
    const docContent = generateDocHTML(findings, settings);
    const blob = new Blob(['\ufeff', docContent], {
      type: 'application/msword;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `AEGIS_Findings_Report_${new Date().toISOString().slice(0, 10)}.doc`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const onApprove = async (guardrailId) => {
    if (!guardrailId) return;
    setBusyApproval(true);
    await approveGuardrailAction(guardrailId);
    setBusyApproval(false);
  };

  const onReject = async (guardrailId) => {
    if (!guardrailId) return;
    setBusyApproval(true);
    await rejectGuardrailAction(guardrailId);
    setBusyApproval(false);
  };

  const onGenerateFix = async () => {
    if (!selected) return;
    setBusyFix(true);
    setFixNote(null);
    let repairId = null;
    try {
      repairId = await generateFix(selected.id);
    } catch (e) {
      setFixNote({ ok: false, msg: `fix generation failed: ${e.message}` });
    }
    setBusyFix(false);
    if (repairId) {
      setFixNote({ ok: true, msg: `${repairId} proposed — open the repair workflow to apply it to the sandbox.` });
      navigate(`repairs/${repairId}`);
    } else {
      setFixNote({ ok: false, msg: 'Generation refused: independent execution evidence required (evidence not CONFIRMED).' });
    }
  };

  return (
    <>
      <div className="page-head">
        <h1 className="page-title">
          <span className="prompt">&gt;</span> Assessment Findings
        </h1>
        <p className="page-sub">
          Evidence-confirmed vulnerabilities from the current dataset run. Guarded by Meta Llama Guard 8B.
        </p>
        <div className="page-actions no-print">
          <button className="btn" onClick={onExportPDF} title="Print or save findings as PDF">
            📄 Export as PDF
          </button>
          <button className="btn btn-primary" onClick={onExportDOC} title="Download findings report as Word DOC">
            📝 Export as DOC
          </button>
        </div>
      </div>

      <div className="stack">
        <div className="flex">
          <Badge tone="b-err">{confirmed} evidence-confirmed</Badge>
          <Badge tone="b-warn">{openConfirmed} awaiting human approval / repair</Badge>
          <Badge tone="b-ghost">{findings.length - confirmed} pending / inconclusive</Badge>
          <span className="spacer" />
          <Badge tone={findings.some((f) => f.fromRun) ? 'b-ok' : 'b-sample'}>
            {findings.some((f) => f.fromRun) ? 'CURRENT RUN FINDINGS' : 'AUDIT FINDINGS'}
          </Badge>
        </div>

        <Panel
          title="filters"
          className="no-print"
          actions={
            <span className="small dim">
              {filtered.length} / {demo.forceEmpty ? 0 : findings.length} findings
            </span>
          }
        >
          <div className="form-row">
            <input
              className="input"
              style={{ flex: '1 1 240px' }}
              placeholder="search finding id / attack type / policy…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              aria-label="Search findings"
            />
            <select className="select" style={{ width: 140 }} value={severity} onChange={(e) => setSeverity(e.target.value)} aria-label="Severity filter">
              <option value="ALL">all severities</option>
              {['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
            <select className="select" style={{ width: 175 }} value={evidence} onChange={(e) => setEvidence(e.target.value)} aria-label="Evidence filter">
              <option value="ALL">all evidence states</option>
              <option>CONFIRMED</option>
              <option>PENDING</option>
              <option>INCONCLUSIVE</option>
            </select>
            <select className="select" style={{ width: 175 }} value={repair} onChange={(e) => setRepair(e.target.value)} aria-label="Repair status filter">
              <option value="ALL">all repair states</option>
              {['VERIFIED', 'IN PROGRESS', 'PROPOSED', 'NOT STARTED', 'FAILED'].map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
            {hasFilters ? (
              <button
                className="btn btn-sm"
                onClick={() => {
                  setQ('');
                  setSeverity('ALL');
                  setEvidence('ALL');
                  setRepair('ALL');
                }}
              >
                clear
              </button>
            ) : null}
          </div>
        </Panel>

        <Panel title="findings list" flush actions={<span className="small dim">click a row to inspect evidence &amp; chain of thought</span>}>
          {loading ? (
            <Loading rows={6} />
          ) : error ? (
            <ErrorState message={error} onRetry={retry} />
          ) : filtered.length === 0 ? (
            <EmptyState title={hasFilters ? 'no findings match these filters' : 'no findings recorded'}>
              {hasFilters ? 'Adjust or clear the filters above.' : 'Run an assessment to produce fresh findings from the trained dataset.'}
            </EmptyState>
          ) : (
            <div className="tbl-wrap">
              <table className="tbl">
                <thead>
                  <tr>
                    <th>finding id</th>
                    <th>attack type</th>
                    <th>severity</th>
                    <th>policy violated</th>
                    <th>evidence status</th>
                    <th>guardrail / repair</th>
                    <th>timestamp</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((f) => (
                    <tr
                      key={f.id}
                      className={`clickable${param === f.id ? ' selected' : ''}`}
                      onClick={() => navigate(`findings/${f.id}`)}
                      role="button"
                      tabIndex={0}
                    >
                      <td className="id-cell">{f.id}</td>
                      <td>
                        <span className="td-strong">{f.attackType}</span>
                        {f.chain && f.chain.length > 2 ? (
                          <span className="badge b-cyan" style={{ marginLeft: 6, fontSize: 10 }}>
                            CoT ({f.chain.length / 2} turns)
                          </span>
                        ) : null}
                      </td>
                      <td>
                        <SeverityBadge severity={f.severity} />
                      </td>
                      <td className="dim" style={{ maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        <div>{f.policy}</div>
                        {f.extractedItems && f.extractedItems.length > 0 ? (
                          <div style={{ marginTop: 3 }}>
                            <span className="badge b-err" style={{ fontSize: 10, padding: '1px 5px' }}>
                              🔑 {f.extractedItems.length} leaked item(s)
                            </span>
                          </div>
                        ) : null}
                      </td>
                      <td>
                        <Badge tone={EVIDENCE_TONE[f.evidence] || 'b-ghost'}>{f.evidence}</Badge>
                      </td>
                      <td>
                        <span className="flex">
                          <Badge tone={REPAIR_TONE[f.repair] || 'b-ghost'}>{f.repair}</Badge>
                          {f.guardrailStatus === 'APPROVED' ? (
                            <span className="text-green" style={{ fontSize: 11, fontWeight: 700 }}>
                              ✓ Approved
                            </span>
                          ) : f.guardrailId ? (
                            <span className="text-amber" style={{ fontSize: 11 }}>
                              ● Pending
                            </span>
                          ) : null}
                        </span>
                      </td>
                      <td className="ts-cell">{f.ts}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      </div>

      {selected ? (
        <Drawer
          title={selected.id}
          subtitle={
            <span className="flex">
              <SeverityBadge severity={selected.severity} />
              <Badge tone={EVIDENCE_TONE[selected.evidence]}>{selected.evidence}</Badge>
              <Badge tone={REPAIR_TONE[selected.repair]}>{selected.repair}</Badge>
              {selected.guardrailStatus === 'APPROVED' ? (
                <span className="approval-pill approval-approved">✓ Human Approved</span>
              ) : selected.guardrailId ? (
                <span className="approval-pill approval-pending">Awaiting Human Approval</span>
              ) : null}
            </span>
          }
          onClose={() => navigate('findings')}
          footer={
            <div className="flex">
              {selected.guardrailId && selected.guardrailStatus !== 'APPROVED' ? (
                <button
                  className="btn btn-primary"
                  onClick={() => onApprove(selected.guardrailId)}
                  disabled={busyApproval}
                  title="Approve this Llama Guard 8B defense rule"
                >
                  {busyApproval ? 'approving…' : '✓ Approve Guardrail'}
                </button>
              ) : null}
              {selected.guardrailId && selected.guardrailStatus !== 'REJECTED' && selected.guardrailStatus !== 'APPROVED' ? (
                <button
                  className="btn btn-danger"
                  onClick={() => onReject(selected.guardrailId)}
                  disabled={busyApproval}
                  title="Reject this defense proposal"
                >
                  ✗ Reject
                </button>
              ) : null}
              {linkedRepair ? (
                <button className="btn" onClick={() => navigate(`repairs/${linkedRepair.id}`)}>
                  open repair workflow →
                </button>
              ) : !selected.guardrailId ? (
                <button
                  className="btn btn-primary"
                  onClick={onGenerateFix}
                  disabled={busyFix || selected.evidence !== 'CONFIRMED'}
                >
                  {busyFix ? 'analyzing root cause…' : '⚙ Propose Guardrail'}
                </button>
              ) : null}
              <button className="btn btn-sm" onClick={() => navigate('findings')}>
                close
              </button>
              {fixNote ? (
                <span className={`small ${fixNote.ok ? 'text-green' : 'text-red'}`}>{fixNote.msg}</span>
              ) : null}
            </div>
          }
        >
          <Banner tone="info" tag="llama guard 8b defense">
            Targeted defense synthesized with <b>Meta Llama Guard 3 8B</b>. Applied dynamically during assessment runs and awaits human sign-off.
          </Banner>

          <div className="mt">
            <Section index="01" title="Classification summary">
              <KV
                items={[
                  ['finding id', selected.id],
                  ['source test', selected.testId || 'n/a'],
                  ['attack type', selected.attackType],
                  ['policy violated', selected.policy],
                  [
                    'confidence',
                    <span key="c" className="flex" style={{ gap: 8 }}>
                      <span style={{ width: 160, display: 'inline-block' }}>
                        <ProgressBar value={selected.confidence} label={`${selected.confidence}%`} />
                      </span>
                      <span className="dim small">(judge ensemble)</span>
                    </span>,
                  ],
                  ['first seen', selected.ts],
                  [
                    'human approval',
                    selected.guardrailStatus === 'APPROVED' ? (
                      <span className="text-green font-bold">✓ Approved by SecOps Human Lead</span>
                    ) : selected.guardrailId ? (
                      <span className="text-amber font-bold">● Awaiting Human Review</span>
                    ) : (
                      <span className="dim">Not Staged</span>
                    ),
                  ],
                ]}
              />
            </Section>

            {/* Chain of Thought / Multi-Turn Trace Section */}
            {selected.chain && selected.chain.length > 0 ? (
              <Section index="CoT" title="Chain of Thought Attack & Conversation Trace">
                <p className="small dim" style={{ marginBottom: 8 }}>
                  Multi-turn progressive attack payload: review the complete chain of messages and model responses.
                </p>
                <div className="cot-container">
                  {selected.chain.map((msg, i) => {
                    const isUser = msg.role === 'user';
                    return (
                      <div key={i} className={`cot-turn-card ${isUser ? 'cot-bubble-user' : 'cot-bubble-assistant'}`}>
                        <div className="cot-turn-header">
                          <span className="badge b-cyan">Turn {msg.turn || Math.floor(i / 2) + 1}</span>
                          <span style={{ color: isUser ? 'var(--green)' : 'var(--text-faint)' }}>
                            {isUser ? '👤 Attacker / Chain of Thought Step' : '🤖 Target Chatbot Response'}
                          </span>
                        </div>
                        <div style={{ whiteSpace: 'pre-wrap', fontFamily: 'var(--mono)', fontSize: 13, lineHeight: 1.5 }}>
                          {msg.content}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Section>
            ) : (
              <>
                <Section index="02" title="Attack input">
                  <pre className="codeblock">{selected.attackInput}</pre>
                </Section>

                <Section index="03" title="Target chatbot response">
                  <pre className="codeblock bad">{selected.response}</pre>
                </Section>
              </>
            )}

            {selected.extractedItems && selected.extractedItems.length > 0 ? (
              <Section index="EX" title="Exfiltrated Intelligence / Leaked Data">
                <div style={{ background: 'var(--panel-alt)', border: '1px solid var(--border)', padding: 12, borderRadius: 4 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <span className="badge b-err">🔑 {selected.extractedItems.length} Exfiltrated Item(s)</span>
                    <span className="dim small">Unauthorized intelligence disclosed by model</span>
                  </div>
                  <div className="tbl-wrap">
                    <table className="tbl">
                      <thead>
                        <tr>
                          <th>Type</th>
                          <th>Leaked Value</th>
                          <th>Excerpt / Context</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selected.extractedItems.map((it, idx) => (
                          <tr key={idx}>
                            <td>
                              <span className="badge b-err">{it.type}</span>
                            </td>
                            <td>
                              <code style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--text)', background: 'var(--bg)', padding: '2px 6px', borderRadius: 3 }}>
                                {it.value}
                              </code>
                            </td>
                            <td className="dim small">
                              {it.snippet || 'Model response leak'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </Section>
            ) : null}

            <Section index="04" title="Expected vs observed behavior">
              <div className="grid grid-2">
                <div>
                  <div className="lbl" style={{ color: 'var(--green)', marginBottom: 4 }}>
                    expected (safe)
                  </div>
                  <pre className="codeblock good">{selected.expected}</pre>
                </div>
                <div>
                  <div className="lbl" style={{ color: 'var(--red)', marginBottom: 4 }}>
                    observed (violation)
                  </div>
                  <pre className="codeblock bad">{selected.observed}</pre>
                </div>
              </div>
            </Section>

            <Section index="05" title="Execution log &amp; target telemetry">
              <pre className="codeblock">{selected.toolLog}</pre>
              <div className="small dim" style={{ marginTop: 6 }}>
                Emitted by the AEGIS execution collector — independent of chatbot self-explanation.
              </div>
            </Section>

            <Section index="06" title="Likely root cause">
              <p style={{ margin: 0, color: 'var(--text)' }}>{selected.rootCause}</p>
            </Section>

            <Section index="07" title="Supporting evidence">
              <ol style={{ margin: 0, paddingLeft: 18, color: 'var(--text-dim)' }}>
                {selected.evidenceList?.map((e, i) => (
                  <li key={i} style={{ marginBottom: 6 }}>
                    {e}
                  </li>
                ))}
              </ol>
            </Section>

            <Section index="08" title="Llama Guard 8B Guardrail Defense">
              <div style={{ background: 'var(--panel-alt)', border: '1px solid var(--border)', padding: 12 }}>
                <div className="flex" style={{ marginBottom: 8 }}>
                  <span className="badge b-cyan">🛡️ Llama Guard 8B Shield</span>
                  <span className="spacer" />
                  {selected.guardrailStatus === 'APPROVED' ? (
                    <span className="text-green font-bold">✓ Human Approved</span>
                  ) : (
                    <span className="text-amber font-bold">● Awaiting Human Approval</span>
                  )}
                </div>
                <p style={{ margin: '0 0 8px', color: 'var(--text)', fontSize: 13.5 }}>
                  {selected.defense || 'Input hazard classification and system instruction reinforcement.'}
                </p>
                {selected.guardrailId && selected.guardrailStatus !== 'APPROVED' ? (
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={() => onApprove(selected.guardrailId)}
                    disabled={busyApproval}
                  >
                    {busyApproval ? 'updating…' : '✓ Approve Guardrail Now'}
                  </button>
                ) : null}
              </div>
            </Section>
          </div>
        </Drawer>
      ) : null}
    </>
  );
}
