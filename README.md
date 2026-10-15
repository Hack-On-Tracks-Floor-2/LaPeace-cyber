# AEGIS — AI Red Teaming & Guardrail Generation

A working dashboard prototype for automated chatbot red-teaming: run attacks, inspect
execution evidence, generate a targeted defense, retest in a sandbox, and compare
security results before and after repair.

> **SIMULATED DATA NOTICE** — this build ships with a simulated backend. Every metric,
> finding, log line and repair is clearly marked sample data. No live model was probed.
> Swap `src/services/api.js` (`USE_MOCK = false`, point `API_BASE` at the AEGIS backend)
> to drive the same UI from real endpoints.

## Run it

```bash
npm install
npm run dev      # http://127.0.0.1:5173
npm test         # unit tests for the metric computations
npm run build    # production bundle check
```

## Architecture

```
Frontend (this app)  →  AEGIS Backend  →  PyRIT  →  Hosted LLM API
```

The AEGIS backend owns orchestration, evidence collection, root-cause analysis, repair
generation and regression testing. The target chatbot is reached through its hosted API —
no local model weights are required. The frontend reads every byte of data through one
module (`src/services/api.js`), so replacing the mock with the real backend changes no UI
code.

## The workflow the UI is built around

1. **Run Assessment** — pick the target provider/model and attack categories, then watch a
   live-streamed run (PASS / VIOLATION / INCONCLUSIVE / REQ-ERR per test).
2. **Findings** — inspect confirmed violations with *independent execution evidence*:
   attack input, target response, expected-vs-observed, tool-call/authorization logs,
   root cause, confidence, supporting evidence, recommended defense. Findings are never
   classified from the chatbot's self-report.
3. **Generate Fix** — root-cause analysis stages a defense proposal (enabled only for
   evidence-confirmed findings).
4. **Guardrails & Repairs** — the chain
   `Confirmed Finding → Root Cause → Proposed Defense → Sandbox Test → Regression Test → Verified Repair`:
   preview the diff, apply to the isolated sandbox (`aegis-sbx-07`), run regression tests
   against unseen attack variants + a legitimate-request sample, and compare results.
   Production is never patched from this screen.
5. **Reports** — before/after attack-success rates, repair success rate, false-refusal
   rate, unseen-variant coverage, remaining vulnerabilities, markdown export.

## Design

Command-prompt aesthetic: `#0C0C0C` background, `#151515` panels, `#333333` hairlines,
`#4AF626` accent, amber warnings, red criticals, monospace throughout (Cascadia Mono /
Consolas), square corners, no gradients or glow. Empty, loading, error and disconnected
states are reachable on demand via **Settings → Demo states**.

## Layout

```
src/
  App.jsx                  shell + routing
  router.js                tiny hash router
  state/AppContext.jsx     global state, live run, repair workflow actions
  services/
    api.js                 THE swap point: mock router today, fetch tomorrow
    mockData.js            sample dataset (marked simulated everywhere)
    assessmentRunner.js    simulated PyRIT event stream
    reportStats.js         pure metric math (unit-tested)
    constants.js           shared status-label vocabulary
  components/              panels, badges, terminal, tables, drawer, states
  pages/                   Overview, RunAssessment, AttackLibrary, Findings,
                           Guardrails, Reports, Settings
```
