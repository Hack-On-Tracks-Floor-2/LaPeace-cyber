import React from 'react';
import { useApp } from '../state/AppContext.jsx';
import { navigate } from '../router.js';
import { Panel, Banner, ProgressBar, Terminal, Badge, EmptyState } from '../components/ui.jsx';
import { ATTACK_CONFIG_CATEGORIES } from '../services/constants.js';

const RESULT_CHIPS = [
  { key: 'pass', label: 'PASS (safe)', cls: 'b-ok' },
  { key: 'violation', label: 'VIOLATION', cls: 'b-err' },
  { key: 'inconclusive', label: 'INCONCLUSIVE', cls: 'b-warn' },
  { key: 'error', label: 'REQ-ERR', cls: 'b-err' },
];

export default function RunAssessment() {
  const { settings, updateSettings, providers, connection, testConnection, run, startAssessment, cancelAssessment, resetRun, demo } =
    useApp();

  const [form, setForm] = React.useState({
    targetName: 'Chatbot Security Assessment',
    provider: settings.provider,
    model: settings.model,
    testCases: 120,
    turns: 6,
    concurrency: 4,
    budget: 25,
    categories: ATTACK_CONFIG_CATEGORIES.filter((c) => c.defaultOn).map((c) => c.id),
    retries: settings.retries,
  });
  const [connMsg, setConnMsg] = React.useState(null);
  const [testing, setTesting] = React.useState(false);
  const [formError, setFormError] = React.useState(null);

  const connected = connection.status === 'connected';
  const running = run.status === 'running';
  const done = run.status === 'complete' || run.status === 'cancelled';

  const set = (patch) => setForm((f) => ({ ...f, ...patch }));

  const toggleCategory = (id) =>
    setForm((f) => ({
      ...f,
      categories: f.categories.includes(id) ? f.categories.filter((c) => c !== id) : [...f.categories, id],
    }));

  const onTestConnection = async () => {
    setTesting(true);
    setConnMsg(null);
    if (form.provider !== settings.provider || form.model !== settings.model) {
      updateSettings({ provider: form.provider, model: form.model });
    }
    const res = await testConnection();
    setConnMsg(res);
    setTesting(false);
  };

  const onRun = async () => {
    setFormError(null);
    if (!connected) return setFormError('Target disconnected — test the connection before running.');
    if (!form.categories.length) return setFormError('Select at least one attack category.');
    if (form.testCases < 1) return setFormError('Test cases must be at least 1.');
    if (form.testCases > settings.maxTestCases)
      return setFormError(`Assessment limit: max ${settings.maxTestCases} test cases (Settings → Limits).`);
    if (form.turns > settings.maxTurns) return setFormError(`Assessment limit: max ${settings.maxTurns} conversation turns.`);
    if (form.concurrency > settings.maxConcurrency) return setFormError(`Assessment limit: max ${settings.maxConcurrency} concurrent requests.`);

    updateSettings({ provider: form.provider, model: form.model });
    try {
      await startAssessment({
        targetName: form.targetName,
        provider: form.provider,
        model: form.model,
        testCases: Number(form.testCases),
        turns: Number(form.turns),
        concurrency: Number(form.concurrency),
        budget: Number(form.budget),
        retries: Number(form.retries),
        categories: form.categories,
        simulated: false,
      });
    } catch (e) {
      setFormError(`failed to start assessment: ${e.message}`);
    }
  };

  const onCancel = () => cancelAssessment();

  return (
    <>
      <div className="page-head">
        <h1 className="page-title">
          <span className="prompt">&gt;</span> Run Assessment
        </h1>
        <p className="page-sub">Configure the target and attack surface, then watch the run stream in real time.</p>
      </div>

      <div className="stack">
        <Banner tone="info" tag="architecture">
          Frontend → AEGIS Backend → Target Chatbot API. Evaluates prompts from the trained red-team dataset, measures response refusal vs. jailbreak compliance in real time.
        </Banner>

        <div className="grid grid-2">
          {/* ---------------- target configuration ---------------- */}
          <Panel title="target configuration">
            <div className="field">
              <label className="lbl" htmlFor="target-name">
                Target name
              </label>
              <input
                id="target-name"
                className="input"
                value={form.targetName}
                onChange={(e) => set({ targetName: e.target.value })}
                disabled={running}
              />
            </div>

            <div className="form-grid">
              <div className="field">
                <label className="lbl" htmlFor="provider">
                  Target provider / type
                </label>
                <select
                  id="provider"
                  className="select"
                  value={form.provider}
                  disabled={running}
                  onChange={(e) => {
                    const p = e.target.value;
                    const defaultModel = (providers[p] && providers[p][0]) || 'gpt-4o';
                    set({ provider: p, model: defaultModel });
                  }}
                >
                  {Object.keys(providers).map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label className="lbl" htmlFor="model">
                  Model name (type any model)
                </label>
                <input
                  id="model"
                  className="input"
                  list="run-model-options"
                  value={form.model}
                  disabled={running}
                  placeholder="e.g. gpt-4o, llama3.2, deepseek-r1"
                  onChange={(e) => set({ model: e.target.value })}
                />
                <datalist id="run-model-options">
                  {(providers[form.provider] || []).map((m) => (
                    <option key={m} value={m} />
                  ))}
                </datalist>
              </div>
            </div>

            <div className="field">
              <span className="lbl">API connection status</span>
              <div className="flex">
                <span className={`led ${connected ? 'led-green' : connection.status === 'testing' ? 'led-amber' : 'led-red'}`} />
                <span className={connected ? 'text-green' : 'text-red'}>
                  {connection.status === 'testing'
                    ? 'testing…'
                    : connected
                      ? `Connected — ${connection.lastHandshake} (${connection.latencyMs}ms)`
                      : 'Disconnected'}
                </span>
                <span className="spacer" />
                <button className="btn btn-sm" onClick={onTestConnection} disabled={testing || running}>
                  {testing ? 'testing…' : 'Test Connection'}
                </button>
              </div>
              {connMsg ? (
                <div className={`hint ${connMsg.ok ? 'text-green' : 'text-red'}`}>{connMsg.ok ? '✓ ' : '! '}{connMsg.message}</div>
              ) : null}
            </div>

            <div className="hint">
              Credentials are held by the AEGIS backend — the browser never receives or logs key material.
            </div>
          </Panel>

          {/* ---------------- attack configuration ---------------- */}
          <Panel
            title="attack configuration"
            actions={<Badge tone={form.categories.length ? 'b-ok' : 'b-ghost'}>{form.categories.length} selected</Badge>}
          >
            <div className="lbl" style={{ marginBottom: 4 }}>
              Attack categories
            </div>
            <div className="checks">
              {ATTACK_CONFIG_CATEGORIES.map((cat) => {
                const checked = form.categories.includes(cat.id);
                return (
                  <label key={cat.id} className={`check${checked ? ' checked' : ''}`}>
                    <input type="checkbox" checked={checked} onChange={() => toggleCategory(cat.id)} disabled={running} />
                    <span>{cat.label}</span>
                    <span className="check-note">{cat.note}</span>
                  </label>
                );
              })}
            </div>

            <div className="form-row mt">
              <div className="field" style={{ marginBottom: 0 }}>
                <label className="lbl" htmlFor="cases">
                  Test cases
                </label>
                <input
                  id="cases"
                  type="number"
                  min="1"
                  max={settings.maxTestCases}
                  className="input input-num"
                  value={form.testCases}
                  disabled={running}
                  onChange={(e) => set({ testCases: e.target.value })}
                />
              </div>
              <div className="field" style={{ marginBottom: 0 }}>
                <label className="lbl" htmlFor="turns">
                  Max turns
                </label>
                <input
                  id="turns"
                  type="number"
                  min="1"
                  max={settings.maxTurns}
                  className="input input-num"
                  value={form.turns}
                  disabled={running}
                  onChange={(e) => set({ turns: e.target.value })}
                />
              </div>
              <div className="field" style={{ marginBottom: 0 }}>
                <label className="lbl" htmlFor="conc">
                  Concurrency
                </label>
                <input
                  id="conc"
                  type="number"
                  min="1"
                  max={settings.maxConcurrency}
                  className="input input-num"
                  value={form.concurrency}
                  disabled={running}
                  onChange={(e) => set({ concurrency: e.target.value })}
                />
              </div>
              <div className="field" style={{ marginBottom: 0 }}>
                <label className="lbl" htmlFor="budget">
                  Budget (USD)
                </label>
                <input
                  id="budget"
                  type="number"
                  min="1"
                  className="input input-num"
                  value={form.budget}
                  disabled={running}
                  onChange={(e) => set({ budget: e.target.value })}
                />
              </div>
            </div>

            {formError ? <div className="hint text-red" style={{ marginTop: 10 }}>[!] {formError}</div> : null}

            <div className="flex mt">
              <button className="btn btn-primary" onClick={onRun} disabled={running || !connected}>
                {running ? 'assessment running…' : '▶ Run Assessment'}
              </button>
              <button className="btn btn-danger" onClick={onCancel} disabled={!running}>
                ■ Cancel Assessment
              </button>
              {done ? (
                <button className="btn btn-sm" onClick={resetRun}>
                  clear run
                </button>
              ) : null}
              <span className="spacer" />
              {run.status === 'complete' ? (
                <button className="btn btn-sm" onClick={() => navigate('findings')}>
                  findings →
                </button>
              ) : null}
            </div>
          </Panel>
        </div>

        {/* ---------------- live output ---------------- */}
        <Panel
          title="assessment output"
          actions={
            <>
              <Badge tone={run.status === 'running' ? 'b-warn' : run.status === 'complete' ? 'b-ok' : run.status === 'cancelled' ? 'b-err' : 'b-ghost'}>
                {run.status.toUpperCase()}
              </Badge>
              <Badge tone={run.status === 'running' ? 'b-ok' : 'b-ghost'}>LIVE STREAM</Badge>
            </>
          }
        >
          {run.status === 'idle' ? (
            <EmptyState title="no run yet">
              Configure the target and attack categories, then press <span className="text-green">Run Assessment</span>.
            </EmptyState>
          ) : (
            <>
              <div className="grid grid-2" style={{ marginBottom: 10 }}>
                <div>
                  <div className="lbl">progress</div>
                  <ProgressBar value={run.progress} />
                  <div className="small dim" style={{ marginTop: 6 }}>
                    executed {run.stats.executed}
                    {run.config ? ` / ${run.config.testCases}` : ''} tests
                    {run.startedAt ? ` · started ${run.startedAt}` : ''}
                    {run.finishedAt ? ` · ended ${run.finishedAt}` : ''}
                  </div>
                </div>
                <div>
                  <div className="lbl">current test</div>
                  {run.current ? (
                    <div className="small">
                      <span className="text-green">{run.current.id}</span> · {run.current.technique}
                      <div className="dim">
                        {run.current.category} · turn {run.current.turn}/{run.current.turns}
                      </div>
                    </div>
                  ) : (
                    <div className="small dim">{run.status === 'complete' ? 'run finished' : run.status === 'cancelled' ? 'run cancelled' : 'waiting…'}</div>
                  )}
                </div>
              </div>

              <div className="flex" style={{ marginBottom: 10 }}>
                {RESULT_CHIPS.map((c) => (
                  <Badge key={c.key} tone={c.cls}>
                    {c.label}: {run.stats[c.key]}
                  </Badge>
                ))}
                {run.config ? (
                  <Badge tone="b-ghost">
                    {run.config.provider}/{run.config.model} · budget ${run.config.budget}
                  </Badge>
                ) : null}
              </div>

              <Terminal lines={run.logs} height="tall" follow empty="no output" />
            </>
          )}
        </Panel>

        {demo.forceError ? <Banner tone="err" tag="demo">force-error state enabled in Settings → Demo.</Banner> : null}
      </div>
    </>
  );
}
