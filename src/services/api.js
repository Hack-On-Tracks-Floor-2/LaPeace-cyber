// ============================================================
// API seam — the single place where the UI talks to a backend.
//
// Target architecture:  Frontend → AEGIS Backend → PyRIT → Hosted LLM API
//
// This prototype ships with USE_MOCK = true: every call resolves against the
// simulated dataset in ./mockData.js with realistic latency. To wire the real
// AEGIS backend, flip USE_MOCK to false and point API_BASE at it — the request
// paths and JSON shapes below are the contract, and no UI code has to change.
// ============================================================

import * as mock from './mockData.js';

export const USE_MOCK = false;
export const API_BASE = '/api/v1';

const MOCK_DELAY_MS = 380;

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function request(path, options = {}) {
  if (USE_MOCK) {
    await delay(MOCK_DELAY_MS + Math.random() * 200);
    return mockRoute(path, options);
  }
  const res = await fetch(API_BASE + path, {
    headers: { 'content-type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    let detail = `HTTP ${res.status}`;
    try {
      const err = await res.json();
      if (err.message || err.detail) {
        detail = err.message || err.detail;
      }
    } catch (_) {}
    throw new Error(detail);
  }
  return res.json();
}

// Mock router: maps endpoint paths to the simulated dataset.
function mockRoute(path) {
  if (path === '/bootstrap') {
    return {
      projects: mock.PROJECTS,
      providers: mock.PROVIDERS,
      settings: mock.DEFAULT_SETTINGS,
      connection: mock.SEED_CONNECTION,
      metrics: mock.SEED_METRICS,
      activity: mock.SEED_ACTIVITY,
      distribution: mock.SEED_DISTRIBUTION,
      beforeAfter: mock.SEED_BEFORE_AFTER,
      findings: mock.SEED_FINDINGS,
      tests: mock.SEED_TESTS,
      repairs: mock.SEED_REPAIRS,
      report: mock.SEED_REPORT,
    };
  }
  if (path === '/overview') {
    return {
      metrics: mock.SEED_METRICS,
      activity: mock.SEED_ACTIVITY,
      distribution: mock.SEED_DISTRIBUTION,
      beforeAfter: mock.SEED_BEFORE_AFTER,
      recentFindings: mock.SEED_FINDINGS.slice(0, 6),
    };
  }
  if (path === '/library') return { tests: mock.SEED_TESTS };
  if (path === '/findings') return { findings: mock.SEED_FINDINGS };
  if (path === '/reports') return { report: mock.SEED_REPORT, findings: mock.SEED_FINDINGS };
  if (path === '/connection/test') return { ok: true, latencyMs: 240 + Math.round(Math.random() * 260) };
  if (path === '/assessments') return { runId: `RUN-0${143 + Math.floor(Math.random() * 9)}`, stream: 'sse', simulated: true };
  if (path.startsWith('/findings/') && path.endsWith('/fix')) return { accepted: true, analyzing: true };
  if (path.startsWith('/repairs/')) return { ok: true, sandbox: 'aegis-sbx-07' };
  if (path === '/settings') return { ok: true, savedAt: new Date().toISOString() };
  if (path === '/settings/test') return { ok: true, latencyMs: 300 };
  throw new Error(`No mock route for ${path}`);
}

export const api = {
  /** Initial load: everything the shell needs. */
  getBootstrap: () => request('/bootstrap'),
  /** Overview page refresh. */
  getOverview: () => request('/overview'),
  getLibrary: () => request('/library'),
  getFindings: () => request('/findings'),
  getReports: () => request('/reports'),

  /** Probe the target chatbot endpoint. */
  testConnection: (payload = {}) =>
    request('/connection/test', { method: 'POST', body: JSON.stringify(payload) }),

  /**
   * Start an assessment. In the prototype the live output is streamed locally
   * by ./assessmentRunner.js; a real backend would return an SSE/WebSocket
   * stream of PyRIT events over this same call.
   */
  startAssessment: (config) =>
    request('/assessments', { method: 'POST', body: JSON.stringify(config) }),

  /** Root-cause analysis + defense proposal for a confirmed finding. */
  generateFix: (findingId) =>
    request(`/findings/${findingId}/fix`, { method: 'POST', body: JSON.stringify({ findingId }) }),

  /** Repair actions always target an isolated sandbox, never production. */
  repairAction: (repairId, action) =>
    request(`/repairs/${repairId}/${action}`, { method: 'POST', body: JSON.stringify({ repairId, action }) }),

  saveSettings: (settings) =>
    request('/settings', { method: 'PUT', body: JSON.stringify(settings) }),

  /** Llama Guard 8B guardrail human approval actions */
  approveGuardrail: (guardrailId) =>
    request(`/guardrails/${guardrailId}/approve`, { method: 'POST' }),

  rejectGuardrail: (guardrailId) =>
    request(`/guardrails/${guardrailId}/reject`, { method: 'POST' }),

  getGuardrails: () => request('/guardrails'),
};
