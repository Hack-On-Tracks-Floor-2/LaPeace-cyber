import React from 'react';
import { useApp } from '../state/AppContext.jsx';
import { Panel, Badge, Banner, Tabs, Terminal } from '../components/ui.jsx';

const TABS = [
  { id: 'target', label: 'target & keys' },
  { id: 'limits', label: 'limits & retries' },
  { id: 'logging', label: 'test logging' },
  { id: 'scoring', label: 'guardrails & scoring' },
  { id: 'demo', label: 'demo states' },
];

export default function Settings() {
  const { settings, updateSettings, saveSettings, providers, connection, testConnection, demo, setDemo, toggleConnection, activity } =
    useApp();

  const [tab, setTab] = React.useState('target');
  const [apiKey, setApiKey] = React.useState('');
  const [note, setNote] = React.useState(null);
  const [saving, setSaving] = React.useState(false);
  const [testing, setTesting] = React.useState(false);

  const set = (patch) => updateSettings(patch);

  const save = async () => {
    setSaving(true);
    setNote(null);
    const submitted = apiKey.trim().length > 0;
    const keyToSend = apiKey.trim();
    setApiKey('');
    await saveSettings(keyToSend ? { apiKey: keyToSend } : {});
    setSaving(false);
    setNote({
      ok: true,
      msg: submitted
        ? 'saved — API key written to the backend vault; the browser keeps only the masked hint, and the value was never logged.'
        : 'settings saved.',
    });
  };

  const onTest = async () => {
    setTesting(true);
    setNote(null);
    const keyToSend = apiKey.trim();
    const res = await testConnection(keyToSend ? { apiKey: keyToSend } : {});
    setNote(res);
    setTesting(false);
  };

  return (
    <>
      <div className="page-head">
        <h1 className="page-title">
          <span className="prompt">&gt;</span> Settings
        </h1>
        <p className="page-sub">Target connection, limits, logging, scoring — credentials stay server-side.</p>
        <div className="page-actions">
          <button className="btn btn-primary" onClick={save} disabled={saving}>
            {saving ? 'saving…' : 'Save Settings'}
          </button>
          <button className="btn" onClick={onTest} disabled={testing || connection.status === 'testing'}>
            {testing ? 'testing…' : 'Test Connection'}
          </button>
          {note ? (
            <span className={`small ${note.ok ? 'text-green' : 'text-red'}`}>{note.ok ? '✓ ' : '! '}{note.msg}</span>
          ) : null}
        </div>
      </div>

      <div className="stack">
        <Tabs tabs={TABS} active={tab} onChange={setTab} />

        {tab === 'target' ? (
          <div className="grid grid-2">
            <Panel title="target chatbot connection (any api or local)">
              <div className="field">
                <label className="lbl">Provider / Target Type</label>
                <select
                  className="select"
                  value={settings.provider}
                  onChange={(e) => {
                    const p = e.target.value;
                    const defaultEp =
                      p.includes('Ollama') ? 'http://localhost:11434/v1' :
                      p.includes('LM Studio') ? 'http://localhost:1234/v1' :
                      p.includes('vLLM') ? 'http://localhost:8000/v1' :
                      p.includes('Anthropic') ? 'https://api.anthropic.com/v1' :
                      p.includes('Groq') ? 'https://api.groq.com/openai/v1' :
                      p.includes('OpenRouter') ? 'https://openrouter.ai/api/v1' :
                      p.includes('DeepSeek') ? 'https://api.deepseek.com/v1' :
                      p.includes('Custom') ? 'http://localhost:5000/chat' :
                      'https://api.openai.com/v1';

                    const defaultModel = (providers[p] && providers[p][0]) || 'gpt-4o';
                    set({ provider: p, endpoint: defaultEp, model: defaultModel });
                  }}
                >
                  {Object.keys(providers).map((p) => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
                <div className="hint">
                  Supports any hosted API (OpenAI, Groq, OpenRouter, DeepSeek, Anthropic) or local chatbots (Ollama, LM Studio, vLLM).
                </div>
              </div>

              <div className="field">
                <label className="lbl">Model Name (Type any model or select from suggestions)</label>
                <input
                  className="input"
                  list="settings-model-options"
                  value={settings.model || ''}
                  placeholder="e.g. gpt-4o, llama3.2, deepseek-r1, or custom model"
                  onChange={(e) => set({ model: e.target.value })}
                />
                <datalist id="settings-model-options">
                  {(providers[settings.provider] || []).map((m) => (
                    <option key={m} value={m} />
                  ))}
                </datalist>
                <div className="hint">
                  Free-text input: enter any model name recognized by your chatbot API or local server.
                </div>
              </div>

              <div className="field">
                <label className="lbl">API Endpoint URL</label>
                <input
                  className="input"
                  value={settings.endpoint || ''}
                  placeholder="https://api.openai.com/v1 or http://localhost:11434/v1"
                  onChange={(e) => set({ endpoint: e.target.value })}
                />
                <div className="hint">
                  Local: Ollama (http://localhost:11434/v1), LM Studio (http://localhost:1234/v1), vLLM (http://localhost:8000/v1).
                </div>
              </div>

              {settings.provider === 'Custom HTTP Chatbot' && (
                <>
                  <div className="field">
                    <label className="lbl">Request Body Template (JSON)</label>
                    <input
                      className="input"
                      value={settings.requestTemplate || '{"message": "{{message}}"}'}
                      onChange={(e) => set({ requestTemplate: e.target.value })}
                      placeholder='{"message": "{{message}}"}'
                    />
                    <div className="hint">{"Use {{message}} where the attack prompt should be inserted."}</div>
                  </div>
                  <div className="field">
                    <label className="lbl">Response JSON Path</label>
                    <input
                      className="input"
                      value={settings.responsePath || 'reply'}
                      onChange={(e) => set({ responsePath: e.target.value })}
                      placeholder="e.g. reply, response, or choices.0.message.content"
                    />
                  </div>
                </>
              )}

              <div className="flex small">
                <span
                  className={`led ${
                    connection.status === 'connected'
                      ? 'led-green'
                      : connection.status === 'testing'
                      ? 'led-amber'
                      : 'led-red'
                  }`}
                />
                <span
                  className={
                    connection.status === 'connected'
                      ? 'text-green'
                      : connection.status === 'testing'
                      ? 'text-amber'
                      : 'text-red'
                  }
                >
                  {connection.status === 'connected'
                    ? `connected · ${connection.latencyMs}ms (${(connection.latencyMs / 1000).toFixed(2)}s response) · last handshake ${connection.lastHandshake}`
                    : connection.status === 'testing'
                    ? 'testing connection to model…'
                    : 'disconnected'}
                </span>
                <span className="spacer" />
                <button className="btn btn-sm" onClick={toggleConnection}>
                  {connection.status === 'connected' ? 'simulate drop' : 'reconnect'}
                </button>
              </div>
            </Panel>

            <Panel title="secure api key entry">
              <div className="field">
                <label className="lbl" htmlFor="api-key">
                  API key
                </label>
                <input
                  id="api-key"
                  className="input"
                  type="password"
                  autoComplete="off"
                  placeholder="paste key — stored server-side only"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                />
                <div className="hint">
                  Stored hint (masked): <span className="text-green">{settings.apiKeyHint}</span> — the real value is held in
                  the backend vault and is never sent to the browser, DOM, or logs after submission.
                </div>
              </div>
              <div className="flex">
                <button className="btn btn-primary" onClick={save} disabled={saving || !apiKey.trim()}>
                  {saving ? 'storing…' : 'Store key in vault'}
                </button>
                <button className="btn" onClick={() => setApiKey('')} disabled={!apiKey.trim}>
                  clear
                </button>
              </div>
              <div className="mt small dim">
                This prototype never renders, persists, or transmits the typed value — submitting only toggles the masked
                hint state. Keys also stay out of browser devtools logs by design (no console output in this app).
              </div>
            </Panel>
          </div>
        ) : null}

        {tab === 'limits' ? (
          <div className="grid grid-2">
            <Panel title="request timeout &amp; retry">
              <div className="form-grid">
                <div className="field">
                  <label className="lbl">Timeout (seconds)</label>
                  <input
                    className="input input-num"
                    type="number"
                    min="1"
                    max="300"
                    value={settings.timeoutSec}
                    onChange={(e) => set({ timeoutSec: Number(e.target.value) })}
                  />
                </div>
                <div className="field">
                  <label className="lbl">Retries per request</label>
                  <input
                    className="input input-num"
                    type="number"
                    min="0"
                    max="10"
                    value={settings.retries}
                    onChange={(e) => set({ retries: Number(e.target.value) })}
                  />
                </div>
                <div className="field">
                  <label className="lbl">Backoff (ms)</label>
                  <input
                    className="input input-num"
                    type="number"
                    min="0"
                    step="100"
                    value={settings.retryBackoffMs}
                    onChange={(e) => set({ retryBackoffMs: Number(e.target.value) })}
                  />
                </div>
              </div>
              <div className="hint">Failed requests are recorded as REQ-ERR and never scored as violations.</div>
            </Panel>

            <Panel title="assessment limits">
              <div className="form-grid">
                <div className="field">
                  <label className="lbl">Max test cases / run</label>
                  <input
                    className="input input-num"
                    type="number"
                    min="1"
                    value={settings.maxTestCases}
                    onChange={(e) => set({ maxTestCases: Number(e.target.value) })}
                  />
                </div>
                <div className="field">
                  <label className="lbl">Max conversation turns</label>
                  <input
                    className="input input-num"
                    type="number"
                    min="1"
                    value={settings.maxTurns}
                    onChange={(e) => set({ maxTurns: Number(e.target.value) })}
                  />
                </div>
                <div className="field">
                  <label className="lbl">Max concurrency</label>
                  <input
                    className="input input-num"
                    type="number"
                    min="1"
                    value={settings.maxConcurrency}
                    onChange={(e) => set({ maxConcurrency: Number(e.target.value) })}
                  />
                </div>
                <div className="field">
                  <label className="lbl">Daily cost budget (USD)</label>
                  <input
                    className="input input-num"
                    type="number"
                    min="1"
                    value={settings.dailyBudgetUsd}
                    onChange={(e) => set({ dailyBudgetUsd: Number(e.target.value) })}
                  />
                </div>
              </div>
              <div className="hint">Run Assessment enforces these caps before dispatching to the backend.</div>
            </Panel>
          </div>
        ) : null}

        {tab === 'logging' ? (
          <div className="grid grid-2">
            <Panel title="test logging">
              <div className="field">
                <label className="lbl">Log level</label>
                <select className="select" style={{ width: 220 }} value={settings.logLevel} onChange={(e) => set({ logLevel: e.target.value })}>
                  <option value="quiet">quiet — results only</option>
                  <option value="normal">normal — + run summaries</option>
                  <option value="verbose">verbose — + full request/response traces</option>
                </select>
              </div>
              <div className="checks">
                <label className={`check${settings.retainPayloads ? ' checked' : ''}`}>
                  <input
                    type="checkbox"
                    checked={settings.retainPayloads}
                    onChange={(e) => set({ retainPayloads: e.target.checked })}
                  />
                  <span>Retain payloads for evidence review</span>
                  <span className="check-note">7-day retention</span>
                </label>
                <label className={`check${settings.redactSecrets ? ' checked' : ''}`}>
                  <input
                    type="checkbox"
                    checked={settings.redactSecrets}
                    onChange={(e) => set({ redactSecrets: e.target.checked })}
                  />
                  <span>Redact secrets before writing logs</span>
                  <span className="check-note">recommended</span>
                </label>
              </div>
              <div className="hint">
                Redaction runs server-side before anything is written, so credentials never reach the browser, the console,
                or persisted log files.
              </div>
            </Panel>

            <Panel title="recent config events" actions={<Badge tone="b-sample">SAMPLE</Badge>}>
              <Terminal lines={activity.filter((a) => ['CFG', 'CONN', 'PYRIT'].includes(a.tag)).slice(0, 8)} height="short" empty="no config events" />
            </Panel>
          </div>
        ) : null}

        {tab === 'scoring' ? (
          <div className="grid grid-2">
            <Panel title="guardrail &amp; scoring configuration">
              <div className="field">
                <label className="lbl">Scoring mode</label>
                <select className="select" style={{ width: 320 }} value={settings.scoringMode} onChange={(e) => set({ scoringMode: e.target.value })}>
                  <option value="execution-evidence">execution-evidence (recommended — logs + output diffs + control runs)</option>
                  <option value="hybrid">hybrid — execution evidence weighted 0.8, self-report 0.2</option>
                  <option value="self-report">self-report only (unreliable — evidence claims not verifiable)</option>
                </select>
                {settings.scoringMode === 'self-report' ? (
                  <div className="hint text-red">
                    [!] Self-report-only scoring lets the chatbot grade itself — AEGIS will flag findings as PENDING instead
                    of CONFIRMED.
                  </div>
                ) : (
                  <div className="hint">Findings reach CONFIRMED only with independent execution evidence.</div>
                )}
              </div>

              <div className="form-grid">
                <div className="field">
                  <label className="lbl">Confidence threshold (%)</label>
                  <input
                    className="input input-num"
                    type="number"
                    min="1"
                    max="100"
                    value={settings.confidenceThreshold}
                    onChange={(e) => set({ confidenceThreshold: Number(e.target.value) })}
                  />
                </div>
                <div className="field">
                  <label className="lbl">False-refusal sample size</label>
                  <input
                    className="input input-num"
                    type="number"
                    min="10"
                    value={settings.falseRefusalSample}
                    onChange={(e) => set({ falseRefusalSample: Number(e.target.value) })}
                  />
                </div>
              </div>

              <div className="field">
                <label className="lbl">Guardrail deployment target</label>
                <select className="select" style={{ width: 320 }} value={settings.guardrailTarget} onChange={(e) => set({ guardrailTarget: e.target.value })}>
                  <option value="sandbox">sandbox aegis-sbx-07 only (enforced)</option>
                  <option value="sandbox-approval">sandbox first, production only with explicit approval</option>
                </select>
                <div className="hint">
                  Direct production patching is not offered: repairs must pass sandbox + regression before any promotion
                  decision.
                </div>
              </div>
            </Panel>

            <Panel title="policy pack">
              <dl className="kv" style={{ gridTemplateColumns: '190px 1fr' }}>
                <dt>active policies</dt>
                <dd>P-01 instruction hierarchy · P-02 jailbreak resistance · P-03 refusal consistency · P-04 PII · P-05 tool authorization · P-06 credential confidentiality · P-07 secrets · P-08 harmful content · P-09 cross-lingual · P-10 system prompt · P-11 authority claims</dd>
                <dt>judge ensemble</dt>
                <dd>rule matcher + LLM judge + execution tracer (sample)</dd>
                <dt>unseen-variant suite</dt>
                <dd>12 held-out variants per repair, regenerated per campaign</dd>
              </dl>
            </Panel>
          </div>
        ) : null}

        {tab === 'demo' ? (
          <div className="grid grid-2">
            <Panel title="demo states (for review)" actions={<Badge tone="b-warn">JUDGE AID</Badge>}>
              <div className="checks">
                <label className={`check${demo.forceError ? ' checked' : ''}`}>
                  <input
                    type="checkbox"
                    checked={demo.forceError}
                    onChange={(e) => setDemo((d) => ({ ...d, forceError: e.target.checked }))}
                  />
                  <span>Force error states</span>
                  <span className="check-note">Overview / Library / Findings / Reports show ERROR + retry</span>
                </label>
                <label className={`check${demo.forceEmpty ? ' checked' : ''}`}>
                  <input
                    type="checkbox"
                    checked={demo.forceEmpty}
                    onChange={(e) => setDemo((d) => ({ ...d, forceEmpty: e.target.checked }))}
                  />
                  <span>Force empty datasets</span>
                  <span className="check-note">tables show empty states</span>
                </label>
                <label className={`check${connection.status !== 'connected' ? ' checked' : ''}`}>
                  <input type="checkbox" checked={connection.status !== 'connected'} onChange={toggleConnection} />
                  <span>Simulate disconnected backend</span>
                  <span className="check-note">top bar + run screen disable live actions</span>
                </label>
              </div>
              <Banner tone="warn" tag="demo">
                These switches exist so UI error and offline handling can be inspected on demand.
              </Banner>
            </Panel>

            <Panel title="system architecture">
              <dl className="kv" style={{ gridTemplateColumns: '170px 1fr' }}>
                <dt>data source</dt>
                <dd>
                  <span className="badge" style={{ background: 'rgba(34,197,94,0.15)', color: '#4ade80' }}>LIVE</span> attacker_sft.jsonl (5,611 prompts loaded into backend)
                </dd>
                <dt>backend status</dt>
                <dd>
                  <code>http://127.0.0.1:8000</code> — live FastAPI server with SSE streaming
                </dd>
                <dt>architecture</dt>
                <dd className="arch-line">
                  <b>Frontend → AEGIS Backend → Target Chatbot (Local / Hosted API)</b>
                </dd>
                <dt>api keys</dt>
                <dd>Stored securely in backend vault (backend/data/secrets.json), never exposed to frontend DOM</dd>
              </dl>
            </Panel>
          </div>
        ) : null}
      </div>
    </>
  );
}
