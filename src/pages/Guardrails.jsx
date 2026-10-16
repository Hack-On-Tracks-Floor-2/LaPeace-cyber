import React from 'react';
import { useApp } from '../state/AppContext.jsx';
import { navigate } from '../router.js';
import { Panel, Badge, EmptyState } from '../components/ui.jsx';

export default function Guardrails({ param }) {
  const { repairs, findings, approveGuardrailAction, batchApproveGuardrailsAction, rejectGuardrailAction } = useApp();
  const [busy, setBusy] = React.useState({});
  const [batchBusy, setBatchBusy] = React.useState(false);
  const [expanded, setExpanded] = React.useState({});
  const [selected, setSelected] = React.useState({});
  const [filter, setFilter] = React.useState('all'); // 'all' | 'pending' | 'approved'

  const busySet = (id, action) => setBusy((b) => ({ ...b, [id]: action }));
  const toggleExpand = (id) => setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));

  const pendingRepairs = repairs.filter(
    (r) => r.humanApproval !== 'APPROVED' && r.humanApproval !== 'REJECTED' && r.stage < 5
  );
  const approvedCount = repairs.filter((r) => r.humanApproval === 'APPROVED' || r.stage >= 5).length;
  const pendingCount = pendingRepairs.length;
  const rejectedCount = repairs.filter((r) => r.humanApproval === 'REJECTED').length;

  const filteredRepairs = repairs.filter((r) => {
    if (filter === 'pending') return r.humanApproval !== 'APPROVED' && r.humanApproval !== 'REJECTED' && r.stage < 5;
    if (filter === 'approved') return r.humanApproval === 'APPROVED' || r.stage >= 5;
    if (filter === 'rejected') return r.humanApproval === 'REJECTED';
    return true;
  });

  const selectedIds = Object.keys(selected).filter((id) => selected[id]);
  const isAllFilteredSelected = filteredRepairs.length > 0 && filteredRepairs.every((r) => selected[r.id]);

  const onToggleSelect = (id) => {
    setSelected((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const onToggleSelectAll = () => {
    if (isAllFilteredSelected) {
      setSelected({});
    } else {
      const next = { ...selected };
      filteredRepairs.forEach((r) => {
        next[r.id] = true;
      });
      setSelected(next);
    }
  };

  const onApprove = async (id) => {
    busySet(id, 'approve');
    try {
      await approveGuardrailAction(id);
      setSelected((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    } finally {
      busySet(id, null);
    }
  };

  const onReject = async (id) => {
    busySet(id, 'reject');
    try {
      await rejectGuardrailAction(id);
      setSelected((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    } finally {
      busySet(id, null);
    }
  };

  const onApproveSelected = async () => {
    if (!selectedIds.length) return;
    setBatchBusy(true);
    try {
      if (batchApproveGuardrailsAction) {
        await batchApproveGuardrailsAction(selectedIds);
      } else {
        for (const id of selectedIds) {
          await approveGuardrailAction(id);
        }
      }
      setSelected({});
    } finally {
      setBatchBusy(false);
    }
  };

  const onApproveAll = async () => {
    if (!repairs.length) return;
    setBatchBusy(true);
    // If pending exist, approve pending; otherwise approve all
    const targetIds = pendingRepairs.length > 0 ? pendingRepairs.map((r) => r.id) : repairs.map((r) => r.id);
    try {
      if (batchApproveGuardrailsAction) {
        await batchApproveGuardrailsAction(targetIds);
      } else {
        for (const id of targetIds) {
          await approveGuardrailAction(id);
        }
      }
      setSelected({});
    } finally {
      setBatchBusy(false);
    }
  };

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">
            <span className="prompt">&gt;</span> Guardrails &amp; Active Defenses
          </h1>
          <p className="page-sub">
            Dynamic runtime guardrails powered by <b>Meta Llama Guard 3 8B</b>. Synthesized automatically upon detected violations to protect subsequent turns.
          </p>
        </div>

        {/* Top Header Action Buttons */}
        <div className="page-actions" style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <button
            className="btn btn-primary"
            onClick={onApproveAll}
            disabled={batchBusy || repairs.length === 0}
            style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600 }}
          >
            {batchBusy ? 'Approving All…' : `✓ Approve All (${pendingCount > 0 ? pendingCount : repairs.length})`}
          </button>

          <button
            className="btn"
            onClick={onApproveSelected}
            disabled={batchBusy || selectedIds.length === 0}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              background: selectedIds.length > 0 ? 'var(--blue)' : undefined,
              color: selectedIds.length > 0 ? '#fff' : undefined,
              fontWeight: 600,
            }}
          >
            {batchBusy ? 'Approving…' : `✓ Approve Selected (${selectedIds.length})`}
          </button>
        </div>
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

        {/* Control Toolbar */}
        {repairs.length > 0 && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: 'var(--panel)',
              border: '1px solid var(--border)',
              padding: '12px 18px',
              borderRadius: 4,
              flexWrap: 'wrap',
              gap: 12,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', userSelect: 'none' }}>
                <input
                  type="checkbox"
                  checked={isAllFilteredSelected}
                  onChange={onToggleSelectAll}
                  disabled={batchBusy || filteredRepairs.length === 0}
                  style={{ width: 16, height: 16, accentColor: 'var(--green)', cursor: 'pointer' }}
                />
                <span style={{ fontSize: 13, fontWeight: 600 }}>
                  Select All
                </span>
              </label>

              {selectedIds.length > 0 && (
                <span className="badge b-cyan" style={{ fontSize: 12 }}>
                  {selectedIds.length} Selected
                </span>
              )}

              {/* View filters */}
              <div style={{ display: 'flex', gap: 4, marginLeft: 8 }}>
                <button
                  className={`btn btn-sm ${filter === 'all' ? 'btn-primary' : ''}`}
                  onClick={() => setFilter('all')}
                  style={{ padding: '2px 8px', fontSize: 11 }}
                >
                  All ({repairs.length})
                </button>
                <button
                  className={`btn btn-sm ${filter === 'pending' ? 'btn-primary' : ''}`}
                  onClick={() => setFilter('pending')}
                  style={{ padding: '2px 8px', fontSize: 11 }}
                >
                  Pending ({pendingCount})
                </button>
                <button
                  className={`btn btn-sm ${filter === 'approved' ? 'btn-primary' : ''}`}
                  onClick={() => setFilter('approved')}
                  style={{ padding: '2px 8px', fontSize: 11 }}
                >
                  Approved ({approvedCount})
                </button>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <button
                className="btn btn-sm btn-primary"
                onClick={onApproveSelected}
                disabled={batchBusy || selectedIds.length === 0}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  fontWeight: 600,
                  opacity: selectedIds.length > 0 ? 1 : 0.6,
                }}
              >
                {batchBusy ? 'Approving…' : `✓ Approve Selected (${selectedIds.length})`}
              </button>

              <button
                className="btn btn-sm btn-primary"
                onClick={onApproveAll}
                disabled={batchBusy || repairs.length === 0}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  background: 'var(--green)',
                  color: '#000',
                  fontWeight: 700,
                }}
              >
                {batchBusy ? 'Approving All…' : `✓ Approve All (${pendingCount > 0 ? pendingCount : repairs.length})`}
              </button>

              {selectedIds.length > 0 && (
                <button
                  className="btn btn-sm"
                  onClick={() => setSelected({})}
                  disabled={batchBusy}
                  style={{ fontSize: 12, color: 'var(--text-dim)' }}
                >
                  Clear Selection
                </button>
              )}
            </div>
          </div>
        )}

        {repairs.length === 0 ? (
          <Panel title="active guardrail list">
            <EmptyState title="No guardrails active yet">
              When an assessment detects a violation, a targeted Llama Guard 8B defense is synthesized here to intercept subsequent attacks.
            </EmptyState>
          </Panel>
        ) : filteredRepairs.length === 0 ? (
          <Panel title="filtered guardrails">
            <EmptyState title={`No ${filter} guardrails`}>
              There are no guardrails matching the '{filter}' filter.
            </EmptyState>
          </Panel>
        ) : (
          <div className="stack" style={{ gap: 12 }}>
            {filteredRepairs.map((r) => {
              const isApproved = r.humanApproval === 'APPROVED' || r.stage >= 5;
              const isRejected = r.humanApproval === 'REJECTED';
              const isPending = !isApproved && !isRejected;
              const isBusy = busy[r.id] || batchBusy;
              const isExp = expanded[r.id];
              const isChecked = !!selected[r.id];

              return (
                <div
                  key={r.id}
                  style={{
                    background: isChecked ? 'rgba(0, 255, 170, 0.04)' : 'var(--panel)',
                    border: isChecked ? '1px solid var(--green)' : '1px solid var(--border)',
                    padding: '16px 20px',
                    borderRadius: 4,
                    transition: 'border-color 0.15s, background-color 0.15s',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => onToggleSelect(r.id)}
                        disabled={isBusy}
                        style={{
                          width: 16,
                          height: 16,
                          accentColor: 'var(--green)',
                          cursor: 'pointer',
                          marginRight: 4,
                        }}
                        title="Select guardrail"
                      />
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

                      {isPending ? (
                        <>
                          <button
                            className="btn btn-sm btn-primary"
                            onClick={() => onApprove(r.id)}
                            disabled={isBusy}
                          >
                            {busy[r.id] === 'approve' ? 'Approving…' : '✓ Approve'}
                          </button>
                          <button
                            className="btn btn-sm"
                            onClick={() => onReject(r.id)}
                            disabled={isBusy}
                          >
                            {busy[r.id] === 'reject' ? 'Rejecting…' : '✕ Reject'}
                          </button>
                        </>
                      ) : (
                        <button
                          className="btn btn-sm"
                          onClick={() => onApprove(r.id)}
                          disabled={isBusy}
                          style={{ fontSize: 11, padding: '2px 8px', color: 'var(--text-dim)' }}
                          title="Re-verify guardrail"
                        >
                          Re-approve
                        </button>
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
