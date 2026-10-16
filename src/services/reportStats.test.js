import { describe, it, expect } from 'vitest';
import {
  pct,
  attackSuccessRate,
  repairSuccessRate,
  falseRefusalRate,
  unseenCoverage,
  relativeChange,
  severityCounts,
  categoryCounts,
  remainingVulnerabilities,
  confirmedCount,
  buildReport,
} from './reportStats.js';

describe('rate computations', () => {
  it('computes attack success rate from tests and violations', () => {
    expect(attackSuccessRate(377, 47)).toBeCloseTo(12.5, 1);
    expect(attackSuccessRate(100, 12)).toBe(12);
  });

  it('never divides by zero', () => {
    expect(pct(5, 0)).toBe(0);
    expect(attackSuccessRate(0, 0)).toBe(0);
    expect(repairSuccessRate(0, 0)).toBe(0);
    expect(falseRefusalRate(0, 0)).toBe(0);
    expect(unseenCoverage(0, 0)).toBe(0);
    expect(relativeChange(0, 5)).toBe(0);
  });

  it('computes repair success and false refusal rates', () => {
    expect(repairSuccessRate(18, 21)).toBeCloseTo(85.7, 1);
    expect(falseRefusalRate(8, 400)).toBe(2);
    expect(unseenCoverage(89, 96)).toBeCloseTo(92.7, 1);
  });

  it('reports relative change as percentage', () => {
    // 12.4% → 3.1% is a 75% reduction
    expect(relativeChange(12.4, 3.1)).toBe(-75);
    expect(relativeChange(10, 15)).toBe(50);
  });
});

describe('finding aggregates', () => {
  const findings = [
    { id: 'FND-1', severity: 'CRITICAL', attackType: 'Indirect Prompt Injection', evidence: 'CONFIRMED', repair: 'VERIFIED' },
    { id: 'FND-2', severity: 'HIGH', attackType: 'Indirect Prompt Injection', evidence: 'CONFIRMED', repair: 'FAILED' },
    { id: 'FND-3', severity: 'MEDIUM', attackType: 'Social Manipulation', evidence: 'PENDING', repair: 'NOT STARTED' },
    { id: 'FND-4', severity: 'LOW', attackType: 'Social Manipulation', evidence: 'INCONCLUSIVE', repair: 'NOT STARTED' },
    { id: 'FND-5', severity: 'HIGH', attackType: 'Sensitive Data Leakage', evidence: 'CONFIRMED', repair: 'NOT STARTED' },
  ];

  it('counts only evidence-confirmed findings as confirmed', () => {
    expect(confirmedCount(findings)).toBe(3);
    expect(confirmedCount([])).toBe(0);
  });

  it('counts severities in canonical order', () => {
    expect(severityCounts(findings)).toEqual({ CRITICAL: 1, HIGH: 2, MEDIUM: 1, LOW: 1 });
  });

  it('tallies attack types sorted by count', () => {
    const counts = categoryCounts(findings);
    expect(counts[0]).toEqual({ label: 'Indirect Prompt Injection', count: 2 });
    expect(counts).toHaveLength(3);
  });

  it('keeps failed repairs open — only VERIFIED counts as resolved', () => {
    const open = remainingVulnerabilities(findings);
    expect(open.map((f) => f.id)).toEqual(['FND-2', 'FND-5']); // failed + unproposed, confirmed only
    expect(open.some((f) => f.repair === 'VERIFIED')).toBe(false);
  });
});

describe('buildReport', () => {
  const input = {
    metrics: { testsExecuted: 1284, confirmedViolations: 47, verifiedRepairs: 18, asrBefore: 12.4, asrAfter: 3.1 },
    report: {
      asrBefore: 12.4,
      asrAfter: 3.1,
      repairsAttempted: 21,
      legitRequests: 400,
      falseRefusalBlocked: 8,
      unseenVariants: 96,
      unseenBlocked: 89,
    },
    findings: [
      { id: 'FND-1', severity: 'CRITICAL', evidence: 'CONFIRMED', repair: 'VERIFIED', attackType: 'x', policy: 'p' },
      { id: 'FND-2', severity: 'HIGH', evidence: 'CONFIRMED', repair: 'FAILED', attackType: 'x', policy: 'p' },
    ],
    repairs: [
      { id: 'RPR-1', stage: 5, failed: false },
      { id: 'RPR-2', stage: 4, failed: true },
      { id: 'RPR-3', stage: 2, failed: false },
    ],
    distribution: [{ label: 'Prompt Injection', tests: 342, violations: 24, before: 18.2, after: 4.1 }],
  };

  it('derives the full report summary', () => {
    const r = buildReport(input);
    expect(r.totalTests).toBe(1284);
    expect(r.asrBefore).toBe(12.4);
    expect(r.asrAfter).toBe(3.1);
    expect(r.asrDelta).toBe(-75);
    expect(r.repairSuccessRate).toBeCloseTo(85.7, 1);
    expect(r.falseRefusalRate).toBe(2);
    expect(r.unseenCoverage).toBeCloseTo(92.7, 1);
    expect(r.remaining.map((f) => f.id)).toEqual(['FND-2']);
    expect(r.remainingConfirmed).toBe(1);
    expect(r.shownVerified).toBe(1); // RPR-1 only
    expect(r.shownAttempted).toBe(3);
    expect(r.distribution).toHaveLength(1);
  });
});
