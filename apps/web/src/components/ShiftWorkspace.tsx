import { FormEvent, useCallback, useEffect, useState } from 'react';
import { ActionGuard } from '../ActionGuard';

type Outlet = { id: string; name: string; outlet_code?: string };
type Shift = { id: string; outlet_id: string; shift_code: string; opening_cash: string | number; opened_at: string; status: string };
type Preview = { shift: Shift; retailTenders: Array<{method:string;paid:string|number}>; barTenders: Array<{method:string;paid:string|number}>; cashMovements: {total:string|number}; cashRefunds:number; expectedCash:number };
const API = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8080';
const money = (n:number) => `₹${n.toFixed(2)}`;

export default function ShiftWorkspace({token}:{token:string}) {
  const [outlets,setOutlets]=useState<Outlet[]>([]);
  const [outletId,setOutletId]=useState('');
  const [shift,setShift]=useState<Shift|null>(null);
  const [preview,setPreview]=useState<Preview|null>(null);
  const [openingCash,setOpeningCash]=useState(0);
  const [shiftCode,setShiftCode]=useState(`SHIFT-${new Date().toISOString().slice(0,10)}`);
  const [direction,setDirection]=useState<'IN'|'OUT'>('IN');
  const [movementAmount,setMovementAmount]=useState(0);
  const [movementReason,setMovementReason]=useState('');
  const [declaredCash,setDeclaredCash]=useState(0);
  const [notes,setNotes]=useState('');
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const [message,setMessage]=useState('');
  const request=useCallback(async(url:string,init?:RequestInit)=>{
    const response=await fetch(`${API}${url}`,{...init,headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`,...((init?.headers??{}) as Record<string,string>)}});
    const payload=await response.json().catch(()=>({}));
    if(!response.ok)throw new Error(payload.error?.message??payload.error?.code??'Request failed');
    return payload;
  },[token]);
  const load=useCallback(async(id:string)=>{
    if(!id)return;
    const payload=await request(`/api/v1/shifts/current?outletId=${id}`);
    setShift(payload.data??null);
    setPreview(null);
    if(payload.data) {
      const p=await request(`/api/v1/shifts/${payload.data.id}/preview`);
      setPreview(p.data);
      setDeclaredCash(Number(p.data.expectedCash??0));
    }
  },[request]);
  useEffect(()=>{
    request('/api/v1/outlets').then((p)=>{
      const rows=p.data??[];setOutlets(rows);
      if(rows[0])setOutletId(rows[0].id);
    }).catch((e)=>setError(e.message));
  },[request]);
  useEffect(()=>{if(outletId)load(outletId).catch((e)=>setError(e.message));},[outletId,load]);
  async function openShift(e:FormEvent){
    e.preventDefault();setBusy(true);setError('');setMessage('');
    try{
      const p=await request('/api/v1/shifts/open',{method:'POST',body:JSON.stringify({outletId,shiftCode,openingCash})});
      setShift(p.data);setMessage('Shift opened successfully.');await load(outletId);
    }catch(e){setError(e instanceof Error?e.message:'Unable to open shift');}finally{setBusy(false);}
  }
  async function addMovement(e:FormEvent){
    e.preventDefault();if(!shift)return;setBusy(true);setError('');setMessage('');
    try{
      await request(`/api/v1/shifts/${shift.id}/cash-movements`,{method:'POST',body:JSON.stringify({direction,amount:movementAmount,reason:movementReason})});
      setMovementAmount(0);setMovementReason('');setMessage('Cash movement recorded.');await load(outletId);
    }catch(e){setError(e instanceof Error?e.message:'Unable to record movement');}finally{setBusy(false);}
  }
  async function closeShift(e:FormEvent){
    e.preventDefault();if(!shift)return;setBusy(true);setError('');setMessage('');
    try{
      const p=await request(`/api/v1/shifts/${shift.id}/close`,{method:'POST',body:JSON.stringify({declaredCash,notes})});
      setMessage(`Shift closed. Cash variance: ${money(Number(p.reconciliation?.variance??0))}.`);
      setShift(null);setPreview(null);
    }catch(e){setError(e instanceof Error?e.message:'Unable to close shift');}finally{setBusy(false);}
  }
  return <section className="shift-workspace">
    <div className="pos-heading"><div><span className="eyebrow">SHIFT CONTROL · DEVELOPMENT/STAGING</span><h2>Shift management</h2><p>Open shifts, record cash movements and reconcile declared cash against POS tenders.</p></div><span className="tag">{shift?'OPEN SHIFT':'NO OPEN SHIFT'}</span></div>
    <label className="shift-outlet">Outlet<select value={outletId} onChange={e=>setOutletId(e.target.value)}><option value="">Select outlet</option>{outlets.map(o=><option key={o.id} value={o.id}>{o.name} {o.outlet_code??''}</option>)}</select></label>
    {!shift&&<ActionGuard action="shift.manage"><form className="shift-form" onSubmit={openShift}>
      <h3>Open a shift</h3>
      <label>Shift code<input required value={shiftCode} onChange={e=>setShiftCode(e.target.value)}/></label>
      <label>Opening cash<input type="number" min="0" step="0.01" value={openingCash} onChange={e=>setOpeningCash(Math.max(0,Number(e.target.value)||0))}/></label>
      <button className="primary-button" disabled={busy||!outletId}>Open shift</button>
    </form></ActionGuard>}
    {shift&&<div className="shift-active">
      <div className="shift-summary"><div><small>Shift</small><strong>{shift.shift_code}</strong></div><div><small>Opened</small><strong>{new Date(shift.opened_at).toLocaleString()}</strong></div><div><small>Opening cash</small><strong>{money(Number(shift.opening_cash))}</strong></div></div>
      {preview&&<div className="shift-summary">
        <div><small>Retail cash</small><strong>{money(preview.retailTenders.filter(x=>x.method==='CASH').reduce((s,x)=>s+Number(x.paid),0))}</strong></div>
        <div><small>Bar cash</small><strong>{money(preview.barTenders.filter(x=>x.method==='CASH').reduce((s,x)=>s+Number(x.paid),0))}</strong></div>
        <div><small>Expected cash</small><strong>{money(Number(preview.expectedCash))}</strong></div>
      </div>}
      <ActionGuard action="shift.manage"><form className="shift-form" onSubmit={addMovement}>
        <h3>Cash movement</h3>
        <label>Direction<select value={direction} onChange={e=>setDirection(e.target.value as 'IN'|'OUT')}><option value="IN">Cash in</option><option value="OUT">Cash out</option></select></label>
        <label>Amount<input type="number" min="0.01" step="0.01" required value={movementAmount||''} onChange={e=>setMovementAmount(Number(e.target.value)||0)}/></label>
        <label>Reason<input required minLength={3} value={movementReason} onChange={e=>setMovementReason(e.target.value)}/></label>
        <button className="secondary-button" disabled={busy||movementAmount<=0||movementReason.trim().length<3}>Record movement</button>
      </form></ActionGuard>
      <ActionGuard action="shift.manage"><form className="shift-form" onSubmit={closeShift}>
        <h3>Close and reconcile</h3>
        <label>Declared physical cash<input type="number" min="0" step="0.01" required value={declaredCash} onChange={e=>setDeclaredCash(Math.max(0,Number(e.target.value)||0))}/></label>
        <label>Closing notes<input value={notes} onChange={e=>setNotes(e.target.value)}/></label>
        {preview&&<p className="shift-variance">Expected cash {money(Number(preview.expectedCash))} · Current variance {money(declaredCash-Number(preview.expectedCash))}</p>}
        <button className="primary-button" disabled={busy}>Close shift</button>
      </form></ActionGuard>
    </div>}
    {error&&<div className="pos-alert error" role="alert">{error}</div>}
    {message&&<div className="pos-alert success" role="status">{message}</div>}
    <p className="pos-disclaimer">Cash figures are operational reconciliation data; verify refunds, cash movements and actual drawer contents before closing.</p>
  </section>;
}
