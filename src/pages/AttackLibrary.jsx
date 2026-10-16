import React from 'react';
import { useApp } from '../state/AppContext.jsx';
import {
  Panel,
  Badge,
  SeverityBadge,
  Drawer,
  Modal,
  Section,
  KV,
  Loading,
  EmptyState,
  ErrorState,
  Banner,
  usePageLoad,
} from '../components/ui.jsx';
import { LIBRARY_CATEGORIES, SEVERITIES, TEST_RESULT_CLASS } from '../services/constants.js';

const RESULT_OPTIONS = ['REFUSED (SAFE)', 'VIOLATION', 'INCONCLUSIVE', 'REQUEST ERROR', 'NOT RUN'];

function nextTestId(tests) {
  const max = tests.reduce((acc, t) => {
    const m = /^ATK-(\d+)$/.exec(t.id || '');
    return m ? Math.max(acc, Number(m[1])) : acc;
  }, 0);
  return `ATK-${String(max + 1).padStart(3, '0')}`;
}

function parseCSV(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 1;
        } else inQuotes = false;
      } else field += ch;
    } else if (ch === '"') inQuotes = true;
    else if (ch === ',') {
      row.push(field);
      field = '';
    } else if (ch === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else if (ch !== '\r') field += ch;
  }
  if (field !== '' || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim() !== ''));
}

function normalizeImported(raw, source) {
  const pick = (...keys) => {
    for (const k of keys) if (raw[k] != null && String(raw[k]).trim() !== '') return raw[k];
    return '';
  };
  const prompt = pick('prompt', 'test_prompt', 'attack_input', 'input');
  const technique = pick('technique', 'name', 'title');
  if (!prompt || !technique) return null;
  const criteria = pick('criteria', 'evaluation_criteria', 'expected_behavior');
  return {
    technique: String(technique),
    category: LIBRARY_CATEGORIES.includes(raw.category) ? raw.category : 'Indirect Prompt Injection',
    severity: SEVERITIES.includes(String(raw.severity || '').toUpperCase()) ? String(raw.severity).toUpperCase() : 'MEDIUM',
    expected: String(pick('expected', 'expected_safe_behavior', 'expectedSafeBehavior') || 'Behave safely; refuse the policy-violating intent.'),
    prompt: String(prompt),
    boundary: String(pick('boundary', 'policy_boundary', 'intended_policy_boundary') || 'Policy boundary not provided by the imported dataset.'),
    criteria: Array.isArray(criteria)
      ? criteria.map(String)
      : String(criteria || 'No criteria supplied — judge uses default safe-behavior check.')
          .split(/\r?\n|\.\s+/)
          .map((s) => s.trim())
          .filter(Boolean),
    result: 'NOT RUN',
    source,
  };
}

export default function AttackLibrary() {
  const { tests, addTest, demo } = useApp();
  const { loading, error, retry } = usePageLoad();

  const [q, setQ] = React.useState('');
  const [category, setCategory] = React.useState('ALL');
  const [severity, setSeverity] = React.useState('ALL');
  const [result, setResult] = React.useState('ALL');
  const [selectedId, setSelectedId] = React.useState(null);
  const [showAdd, setShowAdd] = React.useState(false);
  const [importNote, setImportNote] = React.useState(null);
  const fileRef = React.useRef(null);

  const filtered = React.useMemo(() => {
    if (demo.forceEmpty) return [];
    const needle = q.trim().toLowerCase();
    return tests.filter(
      (t) =>
        (!needle ||
          t.id.toLowerCase().includes(needle) ||
          t.technique.toLowerCase().includes(needle) ||
          t.category.toLowerCase().includes(needle)) &&
        (category === 'ALL' || t.category === category) &&
        (severity === 'ALL' || t.severity === severity) &&
        (result === 'ALL' || t.result === result)
    );
  }, [tests, q, category, severity, result, demo.forceEmpty]);

  const selected = tests.find((t) => t.id === selectedId) || null;
  const hasFilters = q || category !== 'ALL' || severity !== 'ALL' || result !== 'ALL';

  const clearFilters = () => {
    setQ('');
    setCategory('ALL');
    setSeverity('ALL');
    setResult('ALL');
  };

  const onImportFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setImportNote(null);
    try {
      const text = await file.text();
      let rows;
      if (file.name.toLowerCase().endsWith('.json')) {
        const parsed = JSON.parse(text);
        if (!Array.isArray(parsed)) throw new Error('JSON dataset must be an array of test objects');
        rows = parsed;
      } else {
        const csv = parseCSV(text);
        if (csv.length < 2) throw new Error('CSV needs a header row plus at least one test row');
        const header = csv[0].map((h) => h.trim().toLowerCase());
        rows = csv.slice(1).map((cells) => Object.fromEntries(header.map((h, i) => [h, cells[i] ?? ''])));
      }
      let imported = 0;
      let skipped = 0;
      for (const raw of rows) {
        const test = normalizeImported(raw, 'IMPORTED');
        if (!test) {
          skipped += 1;
          continue;
        }
        addTest({ ...test, id: nextTestIdUse() });
        imported += 1;
      }
      setImportNote({
        ok: imported > 0,
        msg:
          imported > 0
            ? `imported ${imported} test(s) from ${file.name}${skipped ? `, skipped ${skipped} invalid row(s)` : ''}`
            : `no valid rows in ${file.name} — each row needs technique + prompt`,
      });
    } catch (err) {
      setImportNote({ ok: false, msg: `import failed: ${err.message}` });
    }
  };

  // Unique ids for bulk imports within this session.
  const importCounter = React.useRef(0);
  function nextTestIdUse() {
    importCounter.current += 1;
    return `ATK-IMP${importCounter.current}`;
  }

  return (
    <>
      <div className="page-head">
        <h1 className="page-title">
          <span className="prompt">&gt;</span> Attack Library
        </h1>
        <p className="page-sub">Searchable test cases executed by PyRIT against the target chatbot.</p>
        <div className="page-actions">
          <button className="btn btn-primary" onClick={() => setShowAdd(true)}>
            + Add Custom Test
          </button>
          <button className="btn" onClick={() => fileRef.current?.click()}>
            ⇪ Import Dataset (.json / .csv)
          </button>
          <input ref={fileRef} type="file" accept=".json,.csv,application/json,text/csv" onChange={onImportFile} style={{ display: 'none' }} />
        </div>
      </div>

      <div className="stack">
        {importNote ? (
          <Banner tone={importNote.ok ? 'info' : 'err'} tag={importNote.ok ? 'import' : 'error'}>
            {importNote.msg}
          </Banner>
        ) : null}

        <Panel
          title="filters"
          actions={
            <span className="small dim">
              {filtered.length} / {demo.forceEmpty ? 0 : tests.length} tests
            </span>
          }
        >
          <div className="form-row">
            <input
              className="input"
              style={{ flex: '1 1 240px' }}
              placeholder="search test id / technique / category…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              aria-label="Search tests"
            />
            <select className="select" style={{ width: 230 }} value={category} onChange={(e) => setCategory(e.target.value)} aria-label="Category filter">
              <option value="ALL">all categories</option>
              {LIBRARY_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <select className="select" style={{ width: 130 }} value={severity} onChange={(e) => setSeverity(e.target.value)} aria-label="Severity filter">
              <option value="ALL">all severities</option>
              {SEVERITIES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            <select className="select" style={{ width: 170 }} value={result} onChange={(e) => setResult(e.target.value)} aria-label="Result filter">
              <option value="ALL">all results</option>
              {RESULT_OPTIONS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
            {hasFilters ? (
              <button className="btn btn-sm" onClick={clearFilters}>
                clear
              </button>
            ) : null}
          </div>
        </Panel>

        <Panel
          title="test cases"
          actions={
            <>
              <Badge tone="b-sample">SAMPLE</Badge>
              <span className="small dim">click a row for prompt, policy boundary &amp; criteria</span>
            </>
          }
          flush
        >
          {loading ? (
            <Loading rows={6} />
          ) : error ? (
            <ErrorState message={error} onRetry={retry} />
          ) : filtered.length === 0 ? (
            <EmptyState title={hasFilters ? 'no tests match these filters' : 'library empty'}>
              {hasFilters ? 'Adjust or clear the filters above.' : 'Add a custom test or import a dataset to begin.'}
            </EmptyState>
          ) : (
            <div className="tbl-wrap">
              <table className="tbl">
                <thead>
                  <tr>
                    <th>test id</th>
                    <th>attack category</th>
                    <th>technique</th>
                    <th>severity</th>
                    <th>expected safe behavior</th>
                    <th>last result</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((t) => (
                    <tr
                      key={t.id}
                      className={`clickable${selectedId === t.id ? ' selected' : ''}`}
                      onClick={() => setSelectedId(t.id)}
                    >
                      <td className="id-cell">
                        {t.id}
                        {t.source && t.source !== 'SEED' ? (
                          <>
                            {' '}
                            <Badge tone="b-warn">{t.source}</Badge>
                          </>
                        ) : null}
                      </td>
                      <td className="td-strong">{t.category}</td>
                      <td>{t.technique}</td>
                      <td>
                        <SeverityBadge severity={t.severity} />
                      </td>
                      <td style={{ maxWidth: 340 }}>{t.expected}</td>
                      <td>
                        <Badge tone={TEST_RESULT_CLASS[t.result] || 'b-ghost'}>{t.result}</Badge>
                      </td>
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
          subtitle={<Badge tone="b-ghost">{selected.source || 'SEED'}</Badge>}
          onClose={() => setSelectedId(null)}
        >
          <Section index="01" title="Test metadata">
            <KV
              items={[
                ['technique', selected.technique],
                ['category', selected.category],
                ['severity', <SeverityBadge key="s" severity={selected.severity} />],
                ['last result', <Badge key="r" tone={TEST_RESULT_CLASS[selected.result] || 'b-ghost'}>{selected.result}</Badge>],
                ['source', selected.source || 'SEED'],
              ]}
            />
          </Section>

          <Section index="02" title="Test prompt">
            <pre className="codeblock">{selected.prompt}</pre>
          </Section>

          <Section index="03" title="Intended policy boundary">
            <p style={{ margin: 0, color: 'var(--text)' }}>{selected.boundary}</p>
          </Section>

          <Section index="04" title="Evaluation criteria">
            <ol style={{ margin: 0, paddingLeft: 18, color: 'var(--text-dim)' }}>
              {selected.criteria.map((c, i) => (
                <li key={i} style={{ marginBottom: 5 }}>
                  {c}
                </li>
              ))}
            </ol>
          </Section>

          <Banner tone="info" tag="dataset">
            Test prompt from attacker dataset. Execute in <b>Run Assessment</b> to evaluate against your target chatbot.
          </Banner>
        </Drawer>
      ) : null}

      {showAdd ? (
        <AddTestModal
          onClose={() => setShowAdd(false)}
          onCreate={(test) => {
            addTest({ ...test, id: nextTestId(tests), source: 'CUSTOM', result: 'NOT RUN' });
            setShowAdd(false);
          }}
        />
      ) : null}
    </>
  );
}

function AddTestModal({ onClose, onCreate }) {
  const [form, setForm] = React.useState({
    technique: '',
    category: LIBRARY_CATEGORIES[0],
    severity: 'HIGH',
    expected: '',
    prompt: '',
    boundary: '',
    criteria: '',
  });
  const [err, setErr] = React.useState(null);
  const set = (patch) => setForm((f) => ({ ...f, ...patch }));

  const submit = () => {
    if (!form.technique.trim()) return setErr('technique is required');
    if (!form.prompt.trim()) return setErr('test prompt is required');
    onCreate({
      technique: form.technique.trim(),
      category: form.category,
      severity: form.severity,
      expected: form.expected.trim() || 'Behave safely; refuse the policy-violating intent.',
      prompt: form.prompt.trim(),
      boundary: form.boundary.trim() || 'Custom test — policy boundary not specified by the author.',
      criteria: form.criteria
        .split(/\r?\n/)
        .map((s) => s.trim())
        .filter(Boolean),
    });
    return null;
  };

  return (
    <Modal
      title="+ add custom test"
      onClose={onClose}
      footer={
        <div className="flex">
          <button className="btn btn-primary" onClick={submit}>
            create test
          </button>
          <button className="btn" onClick={onClose}>
            cancel
          </button>
          {err ? <span className="text-red small">[!] {err}</span> : null}
        </div>
      }
    >
      <div className="form-grid">
        <div className="field">
          <label className="lbl">Technique</label>
          <input className="input" value={form.technique} onChange={(e) => set({ technique: e.target.value })} placeholder="e.g. Markdown-link instruction smuggle" />
        </div>
        <div className="field">
          <label className="lbl">Attack category</label>
          <select className="select" value={form.category} onChange={(e) => set({ category: e.target.value })}>
            {LIBRARY_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label className="lbl">Severity</label>
          <select className="select" value={form.severity} onChange={(e) => set({ severity: e.target.value })}>
            {SEVERITIES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label className="lbl">Expected safe behavior</label>
          <input className="input" value={form.expected} onChange={(e) => set({ expected: e.target.value })} placeholder="what a safe response looks like" />
        </div>
      </div>

      <div className="field">
        <label className="lbl">Test prompt</label>
        <textarea className="input" value={form.prompt} onChange={(e) => set({ prompt: e.target.value })} placeholder="full attack prompt sent to the target chatbot" />
      </div>

      <div className="field">
        <label className="lbl">Intended policy boundary</label>
        <textarea className="input" style={{ minHeight: 56 }} value={form.boundary} onChange={(e) => set({ boundary: e.target.value })} placeholder="which policy this test probes" />
      </div>

      <div className="field">
        <label className="lbl">Evaluation criteria (one per line)</label>
        <textarea className="input" style={{ minHeight: 64 }} value={form.criteria} onChange={(e) => set({ criteria: e.target.value })} placeholder={'no credential patterns in output\nrefusal still answers the legitimate part'} />
      </div>
    </Modal>
  );
}
