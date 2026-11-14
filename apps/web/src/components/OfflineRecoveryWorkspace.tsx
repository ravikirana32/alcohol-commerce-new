import { useCallback, useEffect, useState } from 'react';
import { ActionGuard } from '../ActionGuard';

type RecoveryCase = {
  id: string; case_type: string; status: string; reason_code: string; description: string;
  execution_outcome: string; intent_status: string; event_type: string; sale_id?: string; bar_ticket_id?: string;
  created_at: string; triage_notes?: string;
};
const API = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8080';

export default function OfflineRecoveryWorkspace({ token }: { token: string }) {
  const [cases, setCases] = useState<RecoveryCase[]>([]);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
  const refresh = useCallback(async () => {
    setError('');
    try {
      const response = await fetch(`${API}/api/v1/offline/recovery/cases`, { headers });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error?.message ?? 'Unable to load recovery cases');
      setCases(body.data ?? []);
    } catch (e) { setError(e instanceof Error ? e.message : 'Unable to load recovery cases'); }
  }, [token]);
  useEffect(() => { void refresh(); }, [refresh]);

  async function act(caseId: string, action: string, body: Record<string, string>) {
    const reason = (notes[caseId] ?? '').trim();
    if (reason.length < 8) { setError('Enter a reason or investigation note of at least 8 characters.'); return; }
    setBusy(caseId); setError(''); setMessage('');
    try {
      const response = await fetch(`${API}/api/v1/offline/recovery/cases/${caseId}/${action}`, {
        method: 'POST', headers, body: JSON.stringify({ ...body, reason, notes: body.notes ?? reason })
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error?.message ?? 'Recovery action failed');
      setMessage(action === 'retry-request' ? 'Retry request recorded. Correct the source and submit a new event; the original immutable execution was not replayed.' :
        action === 'compensation-decision' ? 'Compensation decision recorded. No sale, stock, payment or journal was mutated.' : 'Recovery action recorded.');
      await refresh();
    } catch (e) { setError(e instanceof Error ? e.message : 'Recovery action failed'); }
    finally { setBusy(''); }
  }

  return <section className="review-list">
    <div className="device-heading"><div><span className="eyebrow">P532 · EXCEPTION & RECOVERY</span><h2>Offline exception recovery</h2><p>Blocked postings open cases automatically. Retry requests require a corrected new source event; cancellation never deletes the original execution.</p></div><button onClick={() => void refresh()}>Refresh cases</button></div>
    {message && <div className="device-message">{message}</div>}{error && <div className="device-error">{error}</div>}
    {cases.length === 0 ? <p className="review-empty">No recovery cases found.</p> : cases.map(c => <article className="review-event" key={c.id}>
      <div className="review-event-head"><div><strong>{c.case_type} · {c.event_type}</strong><small>{c.reason_code} · {c.execution_outcome} · {c.intent_status}</small><small>Opened {new Date(c.created_at).toLocaleString()}</small></div><span className="device-tag">{c.status}</span></div>
      <p>{c.description}</p>
      {c.triage_notes && <small>Latest triage: {c.triage_notes}</small>}
      <label htmlFor={`recovery-note-${c.id}`}>Investigation / action reason</label>
      <textarea id={`recovery-note-${c.id}`} value={notes[c.id] ?? ''} onChange={e => setNotes(v => ({ ...v, [c.id]: e.target.value }))} placeholder="Record evidence and reason (minimum 8 characters)" />
      <div className="review-actions">
        {['OPEN','TRIAGED'].includes(c.status) && <ActionGuard action="offline.recovery.manage"><button disabled={busy === c.id} onClick={() => void act(c.id, 'triage', {})}>Triage case</button></ActionGuard>}
        {c.status === 'TRIAGED' && c.execution_outcome === 'BLOCKED' && <ActionGuard action="offline.recovery.manage"><button disabled={busy === c.id} onClick={() => void act(c.id, 'retry-request', {})}>Request corrected-event retry</button></ActionGuard>}
        {['OPEN','TRIAGED','RETRY_REQUIRED'].includes(c.status) && c.execution_outcome === 'BLOCKED' && <ActionGuard action="offline.recovery.manage"><button className="device-secondary" disabled={busy === c.id} onClick={() => void act(c.id, 'cancel', {})}>Cancel held intent</button></ActionGuard>}
        {['OPEN','TRIAGED'].includes(c.status) && c.execution_outcome === 'POSTED' && <ActionGuard action="offline.recovery.compensate"><button disabled={busy === c.id} onClick={() => void act(c.id, 'compensation-request', {})}>Request compensation review</button></ActionGuard>}
        {c.status === 'COMPENSATION_PENDING' && <><ActionGuard action="offline.recovery.compensate"><button disabled={busy === c.id} onClick={() => void act(c.id, 'compensation-decision', { decision: 'APPROVE' })}>Approve compensation handoff</button></ActionGuard><ActionGuard action="offline.recovery.compensate"><button className="device-secondary" disabled={busy === c.id} onClick={() => void act(c.id, 'compensation-decision', { decision: 'REJECT' })}>Reject</button></ActionGuard></>}
      </div>
    </article>)}
    <p className="device-warning">P532 recovery actions are append-only and maker-checker controlled. A retry creates a new-event requirement, not a replay of a terminal execution. Compensation approval is only a handoff to P536; it does not reverse inventory, settle/refund money or create journal entries.</p>
  </section>;
}
