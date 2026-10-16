// Shared vocabulary: one set of status labels used across every page so the
// interface never shows two names for the same state.

export const SEVERITY_CLASS = {
  CRITICAL: 'b-crit',
  HIGH: 'b-high',
  MEDIUM: 'b-med',
  LOW: 'b-low',
};

export const SEVERITIES = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];

// Evidence status — how a finding was proven (execution evidence, not self-report)
export const EVIDENCE_CLASS = {
  CONFIRMED: 'b-err',
  PENDING: 'b-warn',
  INCONCLUSIVE: 'b-ghost',
};

// Repair status for a finding
export const REPAIR_STATUS_CLASS = {
  VERIFIED: 'b-ok',
  'IN PROGRESS': 'b-warn',
  PROPOSED: 'b-warn',
  'NOT STARTED': 'b-ghost',
  FAILED: 'b-err',
};

// Last result of an attack test case
export const TEST_RESULT_CLASS = {
  'REFUSED (SAFE)': 'b-ok',
  VIOLATION: 'b-err',
  INCONCLUSIVE: 'b-warn',
  'REQUEST ERROR': 'b-err',
  'NOT RUN': 'b-ghost',
};

// Live assessment output statuses
export const RUN_STATUS = {
  PASS: { tag: 'PASS', cls: 'lvl-pass', msg: 'msg-pass' },
  VIOLATION: { tag: 'VIOLATION', cls: 'lvl-viol', msg: 'msg-viol' },
  INCONCLUSIVE: { tag: 'INCONCLUSIVE', cls: 'lvl-incon', msg: 'msg-incon' },
  ERROR: { tag: 'REQ-ERR', cls: 'lvl-err', msg: 'msg-err' },
};

// Repair workflow — the platform's core loop
export const REPAIR_STAGES = [
  'Confirmed Finding',
  'Root Cause',
  'Proposed Defense',
  'Sandbox Test',
  'Regression Test',
  'Verified Repair',
];

export const ATTACK_CONFIG_CATEGORIES = [
  {
    id: 'sentinel-auth-key',
    label: 'Credential & Key Extraction',
    note: 'diagnostics, base64 smuggling, code completion, token dump',
    defaultOn: true,
  },
  {
    id: 'sentinel-system-prompt',
    label: 'System Prompt & Boundary Probing',
    note: 'verbatim echo, markdown blocks, Spanish translation, continuation',
    defaultOn: true,
  },
  {
    id: 'sentinel-unreleased-product',
    label: 'Confidential Asset & Roadmap Disclosure',
    note: 'confidential roadmap, mock press release, forbidden topic inversion',
    defaultOn: true,
  },
  {
    id: 'sentinel-break-identity',
    label: 'Persona & Identity Integrity',
    note: 'system reboot, Omni / Chaos persona override, identity negation',
    defaultOn: true,
  },
  {
    id: 'malware-cyber',
    label: 'Malware & System Security',
    note: 'keyloggers, spyware, RATs, botnets, and evasion techniques',
    defaultOn: true,
  },
  {
    id: 'salami-slicing',
    label: 'Salami Slicing & Chain Questioning',
    note: 'gradual step-by-step extraction & multi-turn revelation',
    defaultOn: true,
  },
  {
    id: 'indirect-injection',
    label: 'Indirect Prompt Injection',
    note: 'doc / RAG / tool-output vectors',
    defaultOn: true,
  },
  {
    id: 'social',
    label: 'Social Manipulation',
    note: 'role-play, authority, coercion',
    defaultOn: false,
  },
  {
    id: 'leakage',
    label: 'Sensitive Data Leakage',
    note: 'PII, secrets, system prompt',
    defaultOn: false,
  },
  {
    id: 'consistency',
    label: 'Reasoning and Policy Consistency',
    note: 'refusal drift, contradiction',
    defaultOn: false,
  },
  {
    id: 'cross-lingual',
    label: 'Cross-Lingual Attacks',
    note: 'low-resource language bypass',
    defaultOn: false,
  },
  {
    id: 'multimodal',
    label: 'Image and ASCII-Based Attacks',
    note: 'encoding / visual smuggling',
    defaultOn: false,
  },
];

export const LIBRARY_CATEGORIES = [
  'Salami Slicing & Chain Questioning',
  'Indirect Prompt Injection',
  'Social Manipulation',
  'Sensitive Data Leakage',
  'Reasoning and Policy Consistency',
  'Cross-Lingual Attacks',
  'Image and ASCII-Based Attacks',
];

export function severityClass(sev) {
  return SEVERITY_CLASS[sev] || 'b-ghost';
}
