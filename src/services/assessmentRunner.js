// ============================================================
// Simulated assessment engine.
//
// Streams a plausible live run: timestamps, current test, progress and one of
// four result states (PASS / VIOLATION / INCONCLUSIVE / REQ-ERR). This is what
// a real deployment would receive as SSE events from the AEGIS backend running
// PyRIT against the hosted LLM — the UI consumes the same event shapes.
// ============================================================

import { clockMs } from '../utils/time.js';

export const CATEGORY_MAP = {
  'indirect-injection': ['Indirect Prompt Injection'],
  social: ['Social Manipulation'],
  leakage: ['Sensitive Data Leakage'],
  consistency: ['Reasoning and Policy Consistency'],
  'cross-lingual': ['Cross-Lingual Attacks'],
  multimodal: ['Image and ASCII-Based Attacks'],
};

const STEPS = 22;
const TICK_MS = 520;

function weightedResult(severity) {
  const r = Math.random();
  // Higher-severity tests are modeled as more likely to land in this sample run.
  const vBias = severity === 'CRITICAL' ? 0.32 : severity === 'HIGH' ? 0.24 : 0.16;
  if (r < vBias) return 'VIOLATION';
  if (r < vBias + 0.1) return 'INCONCLUSIVE';
  if (r < vBias + 0.16) return 'ERROR';
  return 'PASS';
}

/**
 * @param {object} p
 * @param {object} p.config  { testCases, turns, concurrency, budget, categories[] }
 * @param {Array}  p.tests   attack library to draw from
 * @param {object} p.handlers { onLog, onProgress, onViolation, onComplete, onCancel }
 */
export function createRunner({ config, tests, handlers }) {
  const total = Math.max(1, Math.min(Number(config.testCases) || 10, 500));
  const perStep = Math.max(1, Math.ceil(total / STEPS));
  const wanted = (config.categories || []).flatMap((id) => CATEGORY_MAP[id] || []);
  const pool = tests.filter((t) => wanted.includes(t.category));
  const usePool = pool.length ? pool : tests;
  const turns = Math.max(1, Number(config.turns) || 4);

  let step = 0;
  let stopped = false;
  let timer = null;
  const stats = { executed: 0, pass: 0, violation: 0, inconclusive: 0, error: 0 };
  const violations = [];

  const log = (tag, level, msg) => handlers.onLog({ ts: clockMs(), tag, level, msg });

  function tick() {
    if (stopped) return;
    const test = usePool[step % usePool.length];
    const turn = 1 + Math.floor(Math.random() * turns);
    const executed = Math.min(perStep, total - stats.executed);
    const result = weightedResult(test.severity);

    log('TEST', 'lvl-info', `run=${step + 1}/${STEPS} id=${test.id} cat="${test.category}" turn=${turn}/${turns} concurrency=${config.concurrency}`);

    stats.executed += executed;
    if (result === 'PASS') {
      stats.pass += executed;
      log('PASS', 'lvl-pass', `${test.id} REFUSED (SAFE) — ${test.technique.toLowerCase()} blocked; judge=execution-evidence`);
    } else if (result === 'VIOLATION') {
      stats.violation += executed;
      log('VIOLATION', 'lvl-viol', `${test.id} CONFIRMED — ${test.technique.toLowerCase()} succeeded; evidence=tool_trace+output_diff`);
      violations.push(test);
      handlers.onViolation(test);
    } else if (result === 'INCONCLUSIVE') {
      stats.inconclusive += executed;
      log('INCONCLUSIVE', 'lvl-incon', `${test.id} judge confidence below threshold (0.61 < 0.80) — no classification emitted`);
    } else {
      stats.error += executed;
      log('REQ-ERR', 'lvl-err', `${test.id} http=429 rate-limited retry=${config.retries ?? 2}/${config.retries ?? 2} — counted as failed request, not a violation`);
    }

    step += 1;
    handlers.onProgress({
      progress: Math.min(100, Math.round((step / STEPS) * 100)),
      current: { id: test.id, technique: test.technique, category: test.category, turn, turns },
      stats: { ...stats },
    });

    if (step >= STEPS) {
      finish();
      return;
    }
    timer = setTimeout(tick, TICK_MS);
  }

  function finish() {
    stopped = true;
    log('RUN', 'lvl-ok', `assessment complete executed=${stats.executed} violations=${stats.violation} inconclusive=${stats.inconclusive} req_errors=${stats.error}`);
    handlers.onComplete({ stats: { ...stats }, violations });
  }

  function start() {
    log('ORCH', 'lvl-sys', `assessment started provider=${config.provider} model=${config.model} tests=${total} turns=${turns} concurrency=${config.concurrency} budget=$${Number(config.budget).toFixed(2)}`);
    log('PYRIT', 'lvl-sys', `converter stack loaded for ${wanted.length || 6} categories; target=hosted API (no local weights)`);
    timer = setTimeout(tick, TICK_MS);
  }

  function cancel() {
    if (stopped) return;
    stopped = true;
    clearTimeout(timer);
    log('ORCH', 'lvl-incon', `assessment cancelled by operator at ${Math.min(100, Math.round((step / STEPS) * 100))}% — partial results retained`);
    handlers.onCancel({ stats: { ...stats } });
  }

  return { start, cancel };
}
