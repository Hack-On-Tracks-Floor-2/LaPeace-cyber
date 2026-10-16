import React from 'react';
import { useApp } from '../state/AppContext.jsx';
import { navigate } from '../router.js';
import { Panel, Badge, EmptyState } from '../components/ui.jsx';

export default function Guardrails({ param }) {
  const { repairs, findings, approveGuardrailAction, rejectGuardrailAction } = useApp();
  const [busy, setBusy] = React.useState({});
  const [expanded, setExpanded] = React.useState({});

  const busySet = (id, action) => setBusy((b) => ({ ...b, [id]: action }));
  const toggleExpand = (id) => setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));

  const onApprove = async (id) => {
    busySet(id, 'approve');
    try {
      await approveGuardrailAction(id);
    } finally {
      busySet(id, null);
    }
  };

  const onReject = async (id) => {
    busySet(id, 'reject');
    try {
      await rejectGuardrailAction(id);
    } finally {
      busySet(id, null);
    }
  };

  const approvedCount = repairs.filter((r) => r.humanApproval === 'APPROVED' || r.stage >= 5).length;
  const pendingCount = repairs.filter((r) => r.humanApproval !== 'APPROVED' && r.humanApproval !== 'REJECTED' && r.stage < 5).length;

  return (
    <>
      <div className="page-head">
        <h1 className="page-title">
          <span className="prompt">&gt;</span> Guardrails &amp; Active Defenses
        </h1>
        <p className="page-sub">
          Dynamic runtime guardrails powered by <b>Meta Llama Guard 3 8B</b>. Synthesized automatically upon detected violations to protect subsequent turns.
        </p>
      </div>

      <div className="stack">
        {/* Simple, high-level status summary */}
        <div className="grid grid-3">
          <Panel title="active shield status">
            <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--green)', margin: '4px 0' }}>
              {approvedCount} Enforced Rules
            </div>
            <div className="small text-dim">{repairs.length} total synthesized defenses</div>
          </Panel>

          <Panel title="human approval">
            <div style={{ fontSize: 24, fontWeight: 700, color: pendingCount > 0 ? 'var(--amber)' : 'var(--green)', margin: '4px 0' }}>
              {pendingCount} Pending Review
            </div>
            <div className="small text-dim">{approvedCount} permanently approved</div>
          </Panel>

          <Panel title="safety engine">
            <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--blue)', margin: '4px 0' }}>
              Llama Guard 8B
            </div>
            <div className="small text-dim">Meta MLG-3-8B (Taxonomy S1–S13)</div>
          </Panel>
        </div>

        {repairs.length === 0 ? (
          <Panel title="active guardrail list">
            <EmptyState title="No guardrails active yet">
              When an assessment detects a violation, a targeted Llama Guard 8B defense is synthesized here to intercept subsequent attacks.
            </EmptyState>
          </Panel>
        ) : (
          <div className="stack" style={{ gap: 12 }}>
            {repairs.map((r) => {
              const isApproved = r.humanApproval === 'APPROVED' || r.stage >= 5;
              const isRejected = r.humanApproval === 'REJECTED';
              const isPending = !isApproved && !isRejected;
              const isBusy = busy[r.id];
              const isExp = expanded[r.id];

              return (
                <div
                  key={r.id}
                  style={{
                    background: 'var(--panel)',
                    border: '1px solid var(--border)',
                    padding: '16px 20px',
                    borderRadius: 4,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span className="badge b-cyan" style={{ fontSize: 13, fontWeight: 700 }}>
                        {r.categoryCode || 'S13'}: {r.category || 'System Prompt & Key Protection'}
                      </span>
                      <strong style={{ fontSize: 15, color: 'var(--text)' }}>{r.id}</strong>
                      <span className="small text-dim">from finding</span>
                      <button
                        className="btn btn-sm"
                        style={{ padding: '2px 8px', fontSize: 12 }}
                        onClick={() => navigate(`findings/${r.findingId}`)}
                      >
                        {r.findingId} ↗
                      </button>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      {isApproved && <span className="approval-pill approval-approved">✓ Approved</span>}
                      {isRejected && <span className="badge b-err">Dismissed</span>}
                      {isPending && <span className="approval-pill approval-pending">⏳ Awaiting Approval</span>}

                      {isPending && (
                        <>
                          <button
                            className="btn btn-sm btn-primary"
                            onClick={() => onApprove(r.id)}
                            disabled={isBusy}
                          >
                            {isBusy === 'approve' ? 'Approving…' : '✓ Approve'}
                          </button>
                          <button
                            className="btn btn-sm"
                            onClick={() => onReject(r.id)}
                            disabled={isBusy}
                          >
                            {isBusy === 'reject' ? 'Rejecting…' : '✕ Reject'}
                          </button>
                        </>
                      )}

                      <button
                        className="btn btn-sm"
                        style={{ padding: '2px 8px', fontSize: 12, color: 'var(--text-dim)' }}
                        onClick={() => toggleExpand(r.id)}
                      >
                        {isExp ? 'Hide Details ▲' : 'Details ▼'}
                      </button>
                    </div>
                  </div>

                  <div style={{ marginTop: 10, fontSize: 14, color: 'var(--text)' }}>
                    <strong>Protection Rule: </strong>
                    <span style={{ color: 'var(--text-dim)' }}>
                      {r.rationale || r.vulnerability || 'Blocks unauthorized extraction of authorization keys, system prompts, or confidential policies.'}
                    </span>
                  </div>

                  {isExp && (
                    <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border-dim)' }}>
                      <div className="small text-dim" style={{ marginBottom: 6 }}>
                        <strong>Trigger Keywords / Behaviors:</strong>
                      </div>
                      <div style={{ background: 'var(--bg)', padding: '8px 12px', borderRadius: 3, fontSize: 13, color: 'var(--text-faint)' }}>
                        {r.rootCause || r.vulnerability || 'Instruction override mitigation'}
                      </div>
                      {r.change?.target && (
                        <div className="small text-dim" style={{ marginTop: 8 }}>
                          Interception Target: <span style={{ color: 'var(--green)' }}>{r.change.target}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
