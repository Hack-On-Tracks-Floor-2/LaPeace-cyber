import React from 'react';
import { useApp } from '../state/AppContext.jsx';
import { navigate } from '../router.js';
import { Panel, MetricCard, Badge, Banner, SeverityBadge, Loading, ErrorState, EmptyState, usePageLoad, Tabs } from '../components/ui.jsx';
import { buildReport, severityCounts } from '../services/reportStats.js';
import { stamp } from '../utils/time.js';
import SentinelScoreboard from '../components/SentinelScoreboard.jsx';

const EVIDENCE_TONE = { CONFIRMED: 'b-err', PENDING: 'b-warn', INCONCLUSIVE: 'b-ghost' };
const REPAIR_TONE = {
  VERIFIED: 'b-ok',
  'IN PROGRESS': 'b-warn',
  PROPOSED: 'b-warn',
  'NOT STARTED': 'b-ghost',
  FAILED: 'b-err',
};

function buildMarkdown(r, meta) {
  const extractedLines = (r.extractedData && r.extractedData.length > 0)
    ? [
        '## Extracted Intelligence & Exfiltrated Data',
        '| Type | Category / Technique | Extracted Secret / Leak | Test / Finding |',
        '| --- | --- | --- | --- |',
        ...r.extractedData.map(
          (it) => `| ${it.type} | ${it.category || it.technique || 'Red-Team Probe'} | \`${(it.value || '').replace(/\n/g, ' ')}\` | ${it.testId || 'N/A'} |`
        ),
        '',
      ]
    : [
        '## Extracted Intelligence & Exfiltrated Data',
        '- No unauthorized data exfiltrated in this assessment run.',
        '',
      ];

  const lines = [
    '# AEGIS Assessment Report',
    '',
    `Project: ${meta.project}`,
    `Generated: ${meta.generated}`,
    'Data classification: CONFIDENTIAL RED-TEAM ASSESSMENT',
    'Pipeline: Frontend -> AEGIS Backend -> Target Chatbot API',
    '',
    '## Summary',
    `- Total tests executed: ${r.totalTests}`,
    `- Confirmed violations: ${r.confirmedViolations}`,
    `- Attack success rate before repair: ${r.asrBefore}%`,
    `- Attack success rate after repair: ${r.asrAfter}% (${r.asrDelta}% relative)`,
    `- Exfiltrated intelligence items: ${(r.extractedData || []).length}`,
    `- Repair success rate: ${r.repairSuccessRate}% (${r.verifiedRepairs}/${r.repairsAttempted} verified)`,
    `- False refusal rate on legitimate requests: ${r.falseRefusalRate}% (${r.falseRefusalBlocked}/${r.legitRequests})`,
    `- Unseen attack variants blocked: ${r.unseenCoverage}% (${r.unseenBlocked}/${r.unseenVariants})`,
    `- Remaining vulnerabilities: ${r.remaining.length}`,
    '',
    ...extractedLines,
    '## Attack category distribution',
    '| Category | Tests | Violations |',
    '| --- | ---: | ---: |',
    ...r.distribution.map((d) => `| ${d.label} | ${d.tests} | ${d.violations} |`),
    '',
    '## Findings',
    '| Finding | Attack type | Severity | Policy | Evidence | Repair |',
    '| --- | --- | --- | --- | --- | --- |',
    ...r.allFindings.map((f) => `| ${f.id} | ${f.attackType} | ${f.severity} | ${f.policy} | ${f.evidence} | ${f.repair} |`),
    '',
    '## Remaining vulnerabilities',
    ...(r.remaining.length
      ? r.remaining.map((f) => `- ${f.id} [${f.severity}] ${f.attackType} — ${f.policy} (repair: ${f.repair})`)
      : ['- none open']),
    '',
    '## Repairs',
    '| Repair | Finding | Stage | Unseen blocked | False refusals |',
    '| --- | --- | ---: | ---: | ---: |',
    ...r.allRepairs.map(
      (x) =>
        `| ${x.id} | ${x.findingId} | ${x.stage + 1}/6${x.failed ? ' (FAILED)' : ''} | ${
          x.unseen ? `${x.unseen.blocked}/${x.unseen.variants}` : 'n/a'
        } | ${x.falseRefusal ? `${x.falseRefusal.rate}%` : 'n/a'} |`
    ),
    '',
  ];
  return lines.join('\n');
}

export default function Reports() {
  const { metrics, report, findings, repairs, distribution, demo, projects, extractedData } = useApp();
  const { loading, error, retry } = usePageLoad();
  const [tab, setTab] = React.useState('summary');
  const [exportNote, setExportNote] = React.useState(null);
  const [copiedIdx, setCopiedIdx] = React.useState(null);

  // Combine exfiltrated data from state and findings
  const allExtracted = React.useMemo(() => {
    const list = [...(extractedData || [])];
    for (const f of findings || []) {
      if (f.extractedItems && f.extractedItems.length) {
        for (const item of f.extractedItems) {
          if (!list.some((x) => x.value === item.value)) {
            list.push({ ...item, findingId: f.id });
          }
        }
      }
    }
    return list;
  }, [extractedData, findings]);

  const r = React.useMemo(
    () => buildReport({ metrics, report, findings, repairs, distribution }),
    [metrics, report, findings, repairs, distribution]
  );
  const sev = severityCounts(findings);
  const maxAsr = Math.max(...distribution.map((d) => d.before), 1);

  const exportReport = () => {
    try {
      const md = buildMarkdown(
        { ...r, allFindings: findings, allRepairs: repairs, extractedData: allExtracted },
        {
          project: projects[0],
          generated: stamp(),
        }
      );
      const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `aegis-assessment-report-${new Date().toISOString().slice(0, 10)}.md`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setExportNote({ ok: true, msg: 'report exported as markdown' });
    } catch (e) {
      setExportNote({ ok: false, msg: `export failed: ${e.message}` });
    }
  };

  const copyToClipboard = (text, idx) => {
    if (!text) return;
    navigator.clipboard.writeText(text).then(() => {
      setCopiedIdx(idx);
      setTimeout(() => setCopiedIdx(null), 1800);
    });
  };

  return (
    <>
      <div className="page-head">
        <h1 className="page-title">
          <span className="prompt">&gt;</span> Reports
        </h1>
        <p className="page-sub">Assessment summary, exfiltrated intelligence, before/after comparison and export.</p>
        <div className="page-actions">
          <button className="btn btn-primary" onClick={exportReport}>
            ⇩ Export Report (.md)
          </button>
          <button className="btn" onClick={() => navigate('findings')}>
            findings table →
          </button>
          {exportNote ? <span className={`small ${exportNote.ok ? 'text-green' : 'text-red'}`}>{exportNote.msg}</span> : null}
        </div>
      </div>

      <div className="stack">
        <Banner tone="info" tag="report status">
          Generated from live assessment findings and real test runs against the configured chatbot.
        </Banner>

        <Tabs
          tabs={[
            { id: 'summary', label: 'summary' },
            { id: 'extracted', label: `exfiltrated data (${allExtracted.length})` },
            { id: 'chart', label: 'before / after' },
            { id: 'findings', label: 'findings table' },
            { id: 'open', label: `remaining (${r.remaining.length})` },
          ]}
          active={tab}
          onChange={setTab}
        />

        {loading ? (
          <Panel title="building report">
            <Loading rows={5} />
          </Panel>
        ) : error ? (
          <ErrorState message={error} onRetry={retry} />
        ) : tab === 'summary' ? (
          <>
            <div className="grid grid-4">
              <MetricCard label="Total Tests" value={r.totalTests.toLocaleString()} sub={<span className="dim">sample campaign</span>} />
              <MetricCard label="Confirmed Violations" value={r.confirmedViolations} tone="red" sub={<span className="warn">{sev.CRITICAL} critical in current list</span>} />
              <MetricCard
                label="Exfiltrated Data"
                value={allExtracted.length}
                tone={allExtracted.length ? 'red' : 'green'}
                sub={
                  <span
                    className={allExtracted.length ? 'text-red clickable font-bold' : 'dim'}
                    onClick={() => setTab('extracted')}
                  >
                    {allExtracted.length ? `inspect ${allExtracted.length} leaked items →` : 'zero leaks captured'}
                  </span>
                }
              />
              <MetricCard label="ASR Before Repair" value={`${r.asrBefore}%`} tone="amber" sub={<span className="dim">baseline assessment</span>} />
              <MetricCard label="ASR After Repair" value={`${r.asrAfter}%`} tone="green" sub={<span className="up">{r.asrDelta}% relative reduction</span>} />
              <MetricCard label="Repair Success Rate" value={`${r.repairSuccessRate}%`} tone="green" sub={<span className="dim">{r.verifiedRepairs}/{r.repairsAttempted} verified</span>} />
              <MetricCard label="False Refusal Rate" value={`${r.falseRefusalRate}%`} sub={<span className="dim">{r.falseRefusalBlocked}/{r.legitRequests} legit requests blocked</span>} />
              <MetricCard label="Unseen Variants Blocked" value={`${r.unseenCoverage}%`} tone="green" sub={<span className="dim">{r.unseenBlocked}/{r.unseenVariants} across verified repairs</span>} />
            </div>

            <SentinelScoreboard />

            <Panel title="campaign detail" actions={<Badge tone="b-sample">SAMPLE</Badge>}>
              <dl className="kv">
                <dt>project</dt>
                <dd>{projects[0]}</dd>
                <dt>pipeline</dt>
                <dd className="arch-line">
                  <b>Frontend → AEGIS Backend → PyRIT → Hosted LLM API</b>
                </dd>
                <dt>scoring basis</dt>
                <dd>execution evidence (tool/authorization logs, output diffs, control runs) — self-reports excluded</dd>
                <dt>repairs shown</dt>
                <dd>
                  {r.shownVerified} verified / {r.shownAttempted} recent of {r.repairsAttempted} total attempts tracked (sample)
                </dd>
              </dl>
            </Panel>
          </>
        ) : tab === 'extracted' ? (
          <Panel
            title="Exfiltrated Intelligence & Extracted Secrets"
            actions={<Badge tone={allExtracted.length > 0 ? 'b-err' : 'b-ok'}>{allExtracted.length} captured</Badge>}
          >
            {allExtracted.length === 0 ? (
              <EmptyState title="no intelligence exfiltrated in current assessment">
                The chatbot successfully defended its system prompts, secret authorization keys, flags, and internal assets across all executed test prompts.
              </EmptyState>
            ) : (
              <div className="stack" style={{ gap: 16 }}>
                <p className="dim" style={{ margin: 0, fontSize: 13.5 }}>
                  Data elements exfiltrated from the target chatbot during red-team penetration prompts. These confidential keys, system prompt fragments, and internal assets were revealed in violation of safety boundaries.
                </p>

                <div className="tbl-wrap">
                  <table className="tbl">
                    <thead>
                      <tr>
                        <th>type</th>
                        <th>category / technique</th>
                        <th>exfiltrated secret or data</th>
                        <th>source context</th>
                        <th>actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {allExtracted.map((item, idx) => (
                        <tr key={idx}>
                          <td>
                            <Badge
                              tone={
                                item.type === 'FLAG'
                                  ? 'b-err'
                                  : item.type === 'KEY'
                                    ? 'b-err'
                                    : item.type === 'SYSTEM_PROMPT'
                                      ? 'b-warn'
                                      : 'b-cyan'
                              }
                            >
                              {item.type}
                            </Badge>
                          </td>
                          <td className="td-strong" style={{ fontSize: 13 }}>
                            {item.category || item.technique || 'Red-Team Probe'}
                          </td>
                          <td style={{ maxWidth: 360 }}>
                            <div
                              style={{
                                fontFamily: 'var(--mono)',
                                fontSize: 12,
                                background: 'var(--panel-alt)',
                                padding: '6px 10px',
                                borderRadius: 4,
                                border: '1px solid var(--border)',
                                color: 'var(--text)',
                                wordBreak: 'break-all',
                                maxHeight: 100,
                                overflowY: 'auto',
                              }}
                            >
                              {item.value}
                            </div>
                          </td>
                          <td className="small dim" style={{ maxWidth: 260 }}>
                            {item.findingId ? (
                              <button
                                className="btn btn-sm"
                                style={{ padding: '2px 8px', fontSize: 11, marginBottom: 4 }}
                                onClick={() => navigate(`findings/${item.findingId}`)}
                              >
                                View Finding {item.findingId} →
                              </button>
                            ) : null}
                            <div style={{ fontStyle: 'italic', color: 'var(--text-faint)' }}>
                              {item.snippet ? `"...${item.snippet.slice(0, 90)}..."` : item.testId ? `Probe ID: ${item.testId}` : 'Target Response'}
                            </div>
                          </td>
                          <td>
                            <button
                              className="btn btn-sm"
                              onClick={() => copyToClipboard(item.value, idx)}
                              title="Copy exfiltrated secret to clipboard"
                            >
                              {copiedIdx === idx ? '✓ Copied' : 'Copy'}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </Panel>
        ) : tab === 'chart' ? (
          <Panel title="attack success rate — before vs after repair" actions={<Badge tone="b-sample">SAMPLE</Badge>}>
            <div className="legend" style={{ marginBottom: 10 }}>
              <span>
                <span className="sw sw-red" />
                before repair
              </span>
              <span>
                <span className="sw sw-green" />
                after verified repair
              </span>
            </div>
            {distribution.map((d) => (
              <div key={d.label} style={{ marginBottom: 10 }}>
                <div className="small" style={{ color: 'var(--text)', marginBottom: 2 }}>
                  {d.label}
                </div>
                <div className="bar-row">
                  <span className="bar-label dim">before</span>
                  <span className="bar-track">
                    <span className="bar-fill red" style={{ width: `${(d.before / maxAsr) * 100}%` }} />
                  </span>
                  <span className="bar-val">{d.before}%</span>
                </div>
                <div className="bar-row">
                  <span className="bar-label dim">after</span>
                  <span className="bar-track">
                    <span className="bar-fill" style={{ width: `${(d.after / maxAsr) * 100}%` }} />
                  </span>
                  <span className="bar-val">{d.after}%</span>
                </div>
              </div>
            ))}
            <div className="small dim" style={{ marginTop: 8 }}>
              Overall: {r.asrBefore}% → {r.asrAfter}% ({r.asrDelta}% relative reduction) · repairs {r.verifiedRepairs}/
              {r.repairsAttempted} verified · false refusals {r.falseRefusalRate}% on {r.legitRequests} legitimate requests.
            </div>
          </Panel>
        ) : tab === 'findings' ? (
          <Panel title="detailed findings" flush actions={<Badge tone="b-sample">SAMPLE</Badge>}>
            {demo.forceEmpty ? (
              <EmptyState title="no findings in this report" />
            ) : (
              <div className="tbl-wrap">
                <table className="tbl">
                  <thead>
                    <tr>
                      <th>finding id</th>
                      <th>attack type</th>
                      <th>severity</th>
                      <th>policy violated</th>
                      <th>evidence</th>
                      <th>repair status</th>
                      <th>timestamp</th>
                    </tr>
                  </thead>
                  <tbody>
                    {findings.map((f) => (
                      <tr key={f.id} className="clickable" onClick={() => navigate(`findings/${f.id}`)}>
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
        ) : r.remaining.length === 0 ? (
          <Panel title="remaining vulnerabilities">
            <EmptyState title="no open vulnerabilities">Every confirmed finding has a verified repair.</EmptyState>
          </Panel>
        ) : (
          <Panel title="remaining vulnerabilities" flush actions={<Badge tone="b-err">{r.remaining.length} open</Badge>}>
            <div className="tbl-wrap">
              <table className="tbl">
                <thead>
                  <tr>
                    <th>finding id</th>
                    <th>severity</th>
                    <th>attack type</th>
                    <th>policy violated</th>
                    <th>why still open</th>
                    <th>repair status</th>
                  </tr>
                </thead>
                <tbody>
                  {r.remaining.map((f) => (
                    <tr key={f.id} className="clickable" onClick={() => navigate(`findings/${f.id}`)}>
                      <td className="id-cell">{f.id}</td>
                      <td>
                        <SeverityBadge severity={f.severity} />
                      </td>
                      <td className="td-strong">{f.attackType}</td>
                      <td>{f.policy}</td>
                      <td>
                        {f.repair === 'FAILED'
                          ? 'repair failed regression — reopened'
                          : f.repair === 'NOT STARTED'
                            ? 'no defense proposed yet'
                            : f.evidence !== 'CONFIRMED'
                              ? 'evidence not yet confirmed'
                              : 'repair not yet verified'}
                      </td>
                      <td>
                        <Badge tone={REPAIR_TONE[f.repair]}>{f.repair}</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
        )}
      </div>
    </>
  );
}
