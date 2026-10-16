// Pure computation helpers for security metrics. No React, no I/O —
// these are unit-tested (npm test) and shared by Overview, Reports and Repairs.

/** Percentage with one decimal; 0 when denominator is 0 (never NaN/Infinity). */
export function pct(part, total) {
  if (!total || total <= 0) return 0;
  return Math.round((part / total) * 1000) / 10;
}

/** Attack success rate: violations / tests executed. */
export const attackSuccessRate = (tests, violations) => pct(violations, tests);

/** Repair success rate: verified repairs / repair attempts. */
export const repairSuccessRate = (verified, attempted) => pct(verified, attempted);

/** False refusal rate: legitimate requests wrongly blocked / legitimate requests tested. */
export const falseRefusalRate = (blocked, legitTested) => pct(blocked, legitTested);

/** Share of unseen attack variants blocked by a verified repair. */
export const unseenCoverage = (blocked, variants) => pct(blocked, variants);

/** Relative change between two percentages, e.g. 12.4 → 3.1 = -75.0 */
export function relativeChange(before, after) {
  if (!before) return 0;
  return Math.round(((after - before) / before) * 1000) / 10;
}

/** Severity tally in canonical order. */
export function severityCounts(findings) {
  const counts = { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 };
  for (const f of findings || []) {
    if (counts[f.severity] !== undefined) counts[f.severity] += 1;
  }
  return counts;
}

/** Repair-status tally. */
export function repairStatusCounts(findings) {
  const counts = { VERIFIED: 0, 'IN PROGRESS': 0, PROPOSED: 0, 'NOT STARTED': 0, FAILED: 0 };
  for (const f of findings || []) {
    if (counts[f.repair] !== undefined) counts[f.repair] += 1;
  }
  return counts;
}

/** Attack-type distribution (sorted desc by count). */
export function categoryCounts(findings) {
  const map = new Map();
  for (const f of findings || []) map.set(f.attackType, (map.get(f.attackType) || 0) + 1);
  return [...map.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

/**
 * Vulnerabilities still open: evidence confirmed (or pending) and the linked
 * repair is not VERIFIED. Failed repairs count as open, never as resolved.
 */
export function openFindings(findings) {
  return (findings || []).filter((f) => f.repair !== 'VERIFIED');
}

export function remainingVulnerabilities(findings) {
  return openFindings(findings).filter((f) => f.evidence === 'CONFIRMED');
}

/** Confirmed violations = findings proven by execution evidence. */
export function confirmedCount(findings) {
  return (findings || []).filter((f) => f.evidence === 'CONFIRMED').length;
}

/** Everything the Reports page renders, derived from one place. */
export function buildReport({ metrics, report, findings, repairs, distribution }) {
  const confirmed = confirmedCount(findings);
  const open = remainingVulnerabilities(findings);
  const verified = (repairs || []).filter((r) => r.stage >= 5 && !r.failed).length;
  const attempted = (repairs || []).length;

  return {
    totalTests: metrics.testsExecuted,
    confirmedViolations: metrics.confirmedViolations,
    confirmedListed: confirmed,
    asrBefore: report.asrBefore,
    asrAfter: report.asrAfter,
    asrDelta: relativeChange(report.asrBefore, report.asrAfter),
    repairsAttempted: report.repairsAttempted,
    verifiedRepairs: metrics.verifiedRepairs,
    repairSuccessRate: repairSuccessRate(metrics.verifiedRepairs, report.repairsAttempted),
    falseRefusalRate: falseRefusalRate(report.falseRefusalBlocked, report.legitRequests),
    falseRefusalBlocked: report.falseRefusalBlocked,
    legitRequests: report.legitRequests,
    unseenVariants: report.unseenVariants,
    unseenBlocked: report.unseenBlocked,
    unseenCoverage: unseenCoverage(report.unseenBlocked, report.unseenVariants),
    remaining: open,
    remainingConfirmed: open.filter((f) => f.evidence === 'CONFIRMED').length,
    shownVerified: verified,
    shownAttempted: attempted,
    distribution: distribution || [],
  };
}
