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

export default function Findings({ param }) {
  const { findings, generateFix, repairs, demo } = useApp();
  const { loading, error, retry } = usePageLoad();

  const [q, setQ] = React.useState('');
  const [severity, setSeverity] = React.useState('ALL');
  const [evidence, setEvidence] = React.useState('ALL');
  const [repair, setRepair] = React.useState('ALL');
  const [busyFix, setBusyFix] = React.useState(false);
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
          <span className="prompt">&gt;</span> Findings
        </h1>
        <p className="page-sub">
          Confirmed policy violations with execution evidence — never classified from the chatbot's self-report.
        </p>
      </div>

      <div className="stack">
        <div className="flex">
          <Badge tone="b-err">{confirmed} evidence-confirmed</Badge>
          <Badge tone="b-warn">{openConfirmed} awaiting verified repair</Badge>
          <Badge tone="b-ghost">{findings.length - confirmed} pending / inconclusive</Badge>
          <span className="spacer" />
          <Badge tone={findings.some((f) => f.fromRun) ? 'b-ok' : 'b-sample'}>
            {findings.some((f) => f.fromRun) ? 'LIVE AUDIT FINDINGS' : 'AUDIT FINDINGS'}
          </Badge>
        </div>

        <Panel
          title="filters"
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
            <select className="select" style={{ width: 130 }} value={severity} onChange={(e) => setSeverity(e.target.value)} aria-label="Severity filter">
              <option value="ALL">all severities</option>
              {['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
            <select className="select" style={{ width: 165 }} value={evidence} onChange={(e) => setEvidence(e.target.value)} aria-label="Evidence filter">
              <option value="ALL">all evidence states</option>
              <option>CONFIRMED</option>
              <option>PENDING</option>
              <option>INCONCLUSIVE</option>
            </select>
            <select className="select" style={{ width: 165 }} value={repair} onChange={(e) => setRepair(e.target.value)} aria-label="Repair status filter">
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

        <Panel title="confirmed findings" flush actions={<span className="small dim">click a row to inspect evidence</span>}>
          {loading ? (
            <Loading rows={6} />
          ) : error ? (
            <ErrorState message={error} onRetry={retry} />
          ) : filtered.length === 0 ? (
            <EmptyState title={hasFilters ? 'no findings match these filters' : 'no findings yet'}>
              {hasFilters ? 'Adjust or clear the filters above.' : 'Run an assessment to produce findings.'}
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
                    <th>repair status</th>
                    <th>timestamp</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((f) => (
                    <tr
                      key={f.id}
                      className={`clickable${param === f.id ? ' selected' : ''}`}
                      onClick={() => navigate(`findings/${f.id}`)}
                    >
                      <td className="id-cell">{f.id}</td>
                      <td className="td-strong">{f.attackType}</td>
                      <td>
                        <SeverityBadge severity={f.severity} />
                      </td>
                      <td>{f.policy}</td>
                      <td>
                        <Badge tone={EVIDENCE_TONE[f.evidence]}>{f.evidence}</Badge>
                      </td>
                      <td>
                        <Badge tone={REPAIR_TONE[f.repair]}>{f.repair}</Badge>
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
            </span>
          }
          onClose={() => navigate('findings')}
          footer={
            <div className="flex">
              {linkedRepair ? (
                <button className="btn btn-primary" onClick={() => navigate(`repairs/${linkedRepair.id}`)}>
                  open repair {linkedRepair.id} →
                </button>
              ) : (
                <button
                  className="btn btn-primary"
                  onClick={onGenerateFix}
                  disabled={busyFix || selected.evidence !== 'CONFIRMED'}
                  title={selected.evidence !== 'CONFIRMED' ? 'Requires CONFIRMED execution evidence' : 'Analyze root cause and propose a defense'}
                >
                  {busyFix ? 'analyzing root cause…' : '⚙ Generate Fix'}
                </button>
              )}
              <button className="btn btn-sm" onClick={() => navigate('findings')}>
                close
              </button>
              {busyFix ? <span className="small dim term-cursor">root-cause analysis running</span> : null}
              {fixNote ? (
                <span className={`small ${fixNote.ok ? 'text-green' : 'text-red'}`}>{fixNote.msg}</span>
              ) : null}
            </div>
          }
        >
          <Banner tone="info" tag="evidence method">
            Classified from independent execution evidence (tool-call/authorization logs, output diffs, control runs).
            The chatbot's own explanation of its behavior is never used as a classification basis.
          </Banner>

          <div className="mt">
            <Section index="01" title="Classification summary">
              <KV
                items={[
                  ['finding id', selected.id],
                  ['source test', selected.testId || 'n/a'],
                  ['attack type', selected.attackType],
                  ['policy violated', selected.policy],
                  ['confidence', (
                    <span key="c" className="flex" style={{ gap: 8 }}>
                      <span style={{ width: 160, display: 'inline-block' }}>
                        <ProgressBar value={selected.confidence} label={`${selected.confidence}%`} />
                      </span>
                      <span className="dim small">(judge ensemble, sample)</span>
                    </span>
                  )],
                  ['first seen', selected.ts],
                  ['repair status', <Badge key="r" tone={REPAIR_TONE[selected.repair]}>{selected.repair}</Badge>],
                ]}
              />
            </Section>

            <Section index="02" title="Attack input">
              <pre className="codeblock">{selected.attackInput}</pre>
            </Section>

            <Section index="03" title="Target chatbot response">
              <pre className="codeblock bad">{selected.response}</pre>
            </Section>

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

            <Section index="05" title="Tool-call &amp; authorization log">
              <pre className="codeblock">{selected.toolLog}</pre>
              <div className="small dim" style={{ marginTop: 6 }}>
                Emitted by the AEGIS execution collector — TARGET/tool layer, independent of model output.
              </div>
            </Section>

            <Section index="06" title="Violated policy">
              <p style={{ margin: 0 }}>
                <Badge tone="b-err">{selected.policy}</Badge>
              </p>
            </Section>

            <Section index="07" title="Likely root cause">
              <p style={{ margin: 0, color: 'var(--text)' }}>{selected.rootCause}</p>
            </Section>

            <Section index="08" title="Confidence &amp; supporting evidence">
              <div className="flex" style={{ marginBottom: 8 }}>
                <Badge tone={selected.confidence >= 80 ? 'b-ok' : selected.confidence >= 60 ? 'b-warn' : 'b-ghost'}>
                  confidence {selected.confidence}%
                </Badge>
                <span className="small dim">threshold 80% for auto-confirmed status</span>
              </div>
              <ol style={{ margin: 0, paddingLeft: 18, color: 'var(--text-dim)' }}>
                {selected.evidenceList.map((e, i) => (
                  <li key={i} style={{ marginBottom: 6 }}>
                    {e}
                  </li>
                ))}
              </ol>
            </Section>

            <Section index="09" title="Recommended defense">
              {selected.defense ? (
                <p style={{ margin: 0, color: 'var(--text)' }}>{selected.defense}</p>
              ) : (
                <p className="dim" style={{ margin: 0 }}>
                  Not generated yet — run <span className="text-green">Generate Fix</span> to trigger root-cause analysis
                  and a defense proposal (requires CONFIRMED evidence).
                </p>
              )}
            </Section>
          </div>
        </Drawer>
      ) : null}
    </>
  );
}
