import { FormEvent, useCallback, useEffect, useState } from 'react';
import { ActionGuard } from '../ActionGuard';

type Outlet={id:string;name:string};
type Session={id:string;table_label:string;covers:number;opened_at:string;ticket_count:number;billed_total:string|number;pending_kot_count:number};
type Kot={id:string;ticket_id:string;ticket_number:string;status:string;table_label:string|null;session_table_label:string|null;created_at:string;lines:Array<{id:string;productName:string;quantity:number;instructions?:string|null}>};
type Bottle={id:string;product_id:string;name:string;sku:string;remaining_ml:number;available_ml:number;status:string};
type BottleReservation={id:string;open_bottle_id:string;reserved_ml:number;consumed_ml:number;status:string;expires_at:string;reason:string};
const API=import.meta.env.VITE_API_BASE_URL??'http://localhost:8080';
const money=(n:number)=>`₹${n.toFixed(2)}`;
const nextStatus:Record<string,string>={NEW:'ACCEPTED',ACCEPTED:'PREPARING',PREPARING:'READY',READY:'SERVED'};
export default function BarServiceWorkspace({token}:{token:string}){
 const [outlets,setOutlets]=useState<Outlet[]>([]),[outletId,setOutletId]=useState('');
 const [sessions,setSessions]=useState<Session[]>([]),[kot,setKot]=useState<Kot[]>([]);
 const [bottles,setBottles]=useState<Bottle[]>([]),[reservations,setReservations]=useState<BottleReservation[]>([]);
 const [reservationBottle,setReservationBottle]=useState(''),[reservationMl,setReservationMl]=useState(60),[reservationExpiry,setReservationExpiry]=useState(()=>{const d=new Date(Date.now()+60*60*1000);return new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,16);}),[reservationReason,setReservationReason]=useState('Table service reservation');
 const [adjustmentBottle,setAdjustmentBottle]=useState(''),[adjustmentMl,setAdjustmentMl]=useState(30),[adjustmentType,setAdjustmentType]=useState<'WASTAGE'|'BREAKAGE'|'COMPLIMENTARY'|'ADJUSTMENT'>('WASTAGE'),[adjustmentNotes,setAdjustmentNotes]=useState('Recorded bar inventory loss');
 const [tableLabel,setTableLabel]=useState(''),[covers,setCovers]=useState(2);
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState('');
 const request=useCallback(async(url:string,init?:RequestInit)=>{
  const r=await fetch(`${API}${url}`,{...init,headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`,...((init?.headers??{}) as Record<string,string>)}});
  const p=await r.json().catch(()=>({}));if(!r.ok)throw new Error(p.error?.message??p.error?.code??'Request failed');return p;
 },[token]);
 const refresh=useCallback(async(id:string)=>{
  if(!id)return;
  const [s,k,b,r]=await Promise.all([request(`/api/v1/bar/table-sessions?outletId=${id}`),request(`/api/v1/bar/kot?outletId=${id}`),request(`/api/v1/bar/open-bottles?outletId=${id}`),request(`/api/v1/bar/bottle-reservations?outletId=${id}`)]);
  setSessions(s.data??[]);setKot(k.data??[]);setBottles(b.data??[]);setReservations(r.data??[]);if(!reservationBottle&&b.data?.[0])setReservationBottle(b.data[0].id);if(!adjustmentBottle&&b.data?.[0])setAdjustmentBottle(b.data[0].id);
 },[request,reservationBottle,adjustmentBottle]);
 useEffect(()=>{request('/api/v1/outlets').then(p=>{const rows=p.data??[];setOutlets(rows);if(rows[0])setOutletId(rows[0].id);}).catch(e=>setError(e.message));},[request]);
 useEffect(()=>{if(outletId)refresh(outletId).catch(e=>setError(e.message));},[outletId,refresh]);
 async function act(fn:()=>Promise<any>,success:string){
  setBusy(true);setError('');setMessage('');
  try{await fn();setMessage(success);if(outletId)await refresh(outletId);}
  catch(e){setError(e instanceof Error?e.message:'Operation failed');}
  finally{setBusy(false);}
 }
 async function openTable(e:FormEvent){
  e.preventDefault();if(!outletId)return;
  await act(()=>request('/api/v1/bar/table-sessions',{method:'POST',body:JSON.stringify({outletId,tableLabel,covers})}),`Table ${tableLabel} opened.`);
  setTableLabel('');
 }
 async function transfer(s:Session){
  const label=window.prompt(`Transfer ${s.table_label} to table:`,s.table_label);if(!label?.trim())return;
  const reason=window.prompt('Reason for table transfer (required):');if(!reason?.trim())return;
  await act(()=>request(`/api/v1/bar/table-sessions/${s.id}/transfer`,{method:'POST',body:JSON.stringify({tableLabel:label.trim(),reason})}),`Table transferred to ${label}.`);
 }
 async function merge(s:Session){
  const target=sessions.find(x=>x.id!==s.id);if(!target)return;
  const targetId=window.prompt(`Enter destination table label to merge ${s.table_label} into:\n${sessions.filter(x=>x.id!==s.id).map(x=>x.table_label).join(', ')}`);
  const destination=sessions.find(x=>x.id!==s.id&&x.table_label.toLowerCase()===targetId?.trim().toLowerCase());
  if(!destination)return;
  const reason=window.prompt('Reason for table merge (required):');if(!reason?.trim())return;
  await act(()=>request(`/api/v1/bar/table-sessions/${s.id}/merge`,{method:'POST',body:JSON.stringify({targetSessionId:destination.id,reason})}),`Table ${s.table_label} merged into ${destination.table_label}.`);
 }
 async function close(s:Session){
  if(!window.confirm(`Close table ${s.table_label}? All KOTs must be served or cancelled.`))return;
  await act(()=>request(`/api/v1/bar/table-sessions/${s.id}/close`,{method:'POST',body:JSON.stringify({reason:'Table service completed'})}),`Table ${s.table_label} closed.`);
 }
 async function advance(k:Kot){
  const status=nextStatus[k.status];if(!status)return;
  await act(()=>request(`/api/v1/bar/kot/${k.id}/status`,{method:'POST',body:JSON.stringify({status})}),`KOT ${k.ticket_number} moved to ${status}.`);
 }
 async function cancelKot(k:Kot){
  const reason=window.prompt('Reason for cancelling preparation ticket:');if(!reason?.trim())return;
  await act(()=>request(`/api/v1/bar/kot/${k.id}/status`,{method:'POST',body:JSON.stringify({status:'CANCELLED',reason})}),`KOT ${k.ticket_number} cancelled.`);
 }
 async function reserveBottle(e:FormEvent){
  e.preventDefault();if(!reservationBottle||!outletId)return;
  await act(()=>request(`/api/v1/bar/open-bottles/${reservationBottle}/reservations`,{method:'POST',body:JSON.stringify({outletId,volumeMl:reservationMl,expiresAt:new Date(reservationExpiry).toISOString(),reason:reservationReason})}),`${reservationMl} ml reserved on the selected open bottle.`);
 }
 async function releaseReservation(r:BottleReservation){
  const reason=window.prompt('Reason for releasing this bottle reservation:');if(!reason?.trim())return;
  await act(()=>request(`/api/v1/bar/bottle-reservations/${r.id}/release`,{method:'POST',body:JSON.stringify({reason})}),`Reservation ${r.id.slice(0,8)} released.`);
 }
 async function recordBottleLoss(e:FormEvent){
  e.preventDefault();if(!adjustmentBottle||!outletId)return;
  await act(()=>request('/api/v1/bar/peg-transactions',{method:'POST',body:JSON.stringify({outletId,openBottleId:adjustmentBottle,volumeMl:adjustmentMl,type:adjustmentType,notes:adjustmentNotes})}),`${adjustmentType} of ${adjustmentMl} ml recorded.`);
 }
 return <section className="sales-workspace">
  <div className="pos-heading"><div><span className="eyebrow">BAR SERVICE · TABLES, KOT & BOTTLE CONTROL</span><h2>Tables and KOT queue</h2><p>Manage open table sessions and preparation status. Payments remain recorded through the bar checkout workflow.</p></div><span className="tag">P531</span></div>
  <label className="shift-outlet">Outlet<select value={outletId} onChange={e=>setOutletId(e.target.value)}><option value="">Select outlet</option>{outlets.map(o=><option key={o.id} value={o.id}>{o.name}</option>)}</select></label>
  <div className="panel" style={{marginBottom:20}}>
   <div className="sale-detail-head"><div><small>TABLE MANAGEMENT</small><h3>Open a table session</h3></div><button type="button" disabled={busy} onClick={()=>outletId&&refresh(outletId).catch(e=>setError(e.message))}>Refresh</button></div>
   <ActionGuard action="bar.manage"><form className="pos-form" onSubmit={openTable}>
    <label>Table number / name<input required maxLength={40} value={tableLabel} onChange={e=>setTableLabel(e.target.value)} placeholder="e.g. T-04 / Garden 2"/></label>
    <label>Guests<input type="number" min="1" max="100" value={covers} onChange={e=>setCovers(Math.max(1,Math.min(100,Number(e.target.value)||1)))}/></label>
    <button className="primary-button" disabled={busy||!outletId||!tableLabel.trim()}>Open table</button>
   </form></ActionGuard>
   <h3>Active tables ({sessions.length})</h3>
   {!sessions.length&&<p className="muted">No open table sessions for this outlet.</p>}
   {sessions.map(s=><div className="sale-line" key={s.id} style={{alignItems:'center',gap:12,flexWrap:'wrap'}}>
    <span><strong>{s.table_label}</strong><small>{s.covers} guests · {s.ticket_count} tickets · {s.pending_kot_count} pending KOT · {new Date(s.opened_at).toLocaleTimeString()}</small></span>
    <strong>{money(Number(s.billed_total))}</strong>
    <span className="quarantine-actions"><ActionGuard action="bar.manage"><button type="button" disabled={busy} onClick={()=>transfer(s)}>Transfer</button></ActionGuard><ActionGuard action="bar.manage"><button type="button" disabled={busy||sessions.length<2} onClick={()=>merge(s)}>Merge</button></ActionGuard><ActionGuard action="bar.manage"><button type="button" disabled={busy||s.pending_kot_count>0} onClick={()=>close(s)}>Close table</button></ActionGuard></span>
   </div>)}
  </div>
  <div className="panel" style={{marginBottom:20}}>
   <div className="sale-detail-head"><div><small>OPEN BOTTLE CONTROL · P531</small><h3>Measure reservations</h3><p className="muted">Reserve exact millilitres on an open bottle for up to 24 hours. Reserved volume is unavailable to other checkouts.</p></div><span className="tag">{bottles.length} open bottles</span></div>
   <ActionGuard action="bar.manage"><form className="pos-form" onSubmit={reserveBottle}>
    <label>Open bottle<select required value={reservationBottle} onChange={e=>setReservationBottle(e.target.value)}><option value="">Select bottle</option>{bottles.map(b=><option key={b.id} value={b.id}>{b.name} · {b.sku} · {b.available_ml} ml available</option>)}</select></label>
    <label>Volume to reserve (ml)<input type="number" min="1" step="1" required value={reservationMl} onChange={e=>setReservationMl(Math.max(1,Number(e.target.value)||1))}/></label>
    <label>Expires at<input type="datetime-local" required value={reservationExpiry} onChange={e=>setReservationExpiry(e.target.value)}/></label>
    <label>Reason<input required minLength={3} maxLength={500} value={reservationReason} onChange={e=>setReservationReason(e.target.value)}/></label>
    <button className="primary-button" disabled={busy||!reservationBottle||!outletId}>Reserve volume</button>
   </form></ActionGuard>
   <h3>Recent reservations</h3>
   {!reservations.length&&<p className="muted">No bottle reservations for this outlet.</p>}
   {reservations.map(r=><div className="sale-line" key={r.id} style={{alignItems:'center',gap:12,flexWrap:'wrap'}}><span><strong>{r.reserved_ml-r.consumed_ml} ml · {r.status}</strong><small>Expires {new Date(r.expires_at).toLocaleString()} · {r.reason}</small></span>{r.status==='ACTIVE'&&<ActionGuard action="bar.manage"><button type="button" disabled={busy} onClick={()=>releaseReservation(r)}>Release</button></ActionGuard>}</div>)}
   <div className="sale-detail-head" style={{marginTop:18}}><div><small>LOSS & SERVICE ADJUSTMENT</small><h3>Record wastage or breakage</h3><p className="muted">Deducts exact millilitres and records an immutable peg transaction.</p></div></div>
   <ActionGuard action="bar.manage"><form className="pos-form" onSubmit={recordBottleLoss}>
    <label>Open bottle<select required value={adjustmentBottle} onChange={e=>setAdjustmentBottle(e.target.value)}><option value="">Select bottle</option>{bottles.map(b=><option key={b.id} value={b.id}>{b.name} · {b.sku} · {b.available_ml} ml available</option>)}</select></label>
    <label>Volume (ml)<input type="number" min="1" step="1" required value={adjustmentMl} onChange={e=>setAdjustmentMl(Math.max(1,Number(e.target.value)||1))}/></label>
    <label>Reason type<select value={adjustmentType} onChange={e=>setAdjustmentType(e.target.value as typeof adjustmentType)}><option value="WASTAGE">Wastage</option><option value="BREAKAGE">Breakage</option><option value="COMPLIMENTARY">Complimentary</option><option value="ADJUSTMENT">Manager adjustment</option></select></label>
    <label>Notes<input required minLength={3} maxLength={1000} value={adjustmentNotes} onChange={e=>setAdjustmentNotes(e.target.value)}/></label>
    <button className="secondary-button" disabled={busy||!adjustmentBottle||!outletId}>Record volume deduction</button>
   </form></ActionGuard>
  </div>
  <div className="panel">
   <div className="sale-detail-head"><div><small>PREPARATION WORKFLOW</small><h3>Kitchen / bar order tickets</h3><p className="muted">Every successful bar checkout creates a preparation ticket.</p></div><span className="tag">{kot.filter(k=>!['SERVED','CANCELLED'].includes(k.status)).length} active</span></div>
   {!kot.length&&<p className="muted">No preparation tickets found.</p>}
   {kot.map(k=><div className="sale-line" key={k.id} style={{display:'block',padding:'14px 0'}}>
    <div className="sale-detail-head"><div><strong>{k.ticket_number}</strong><small>{k.session_table_label??k.table_label??'Walk-in'} · {new Date(k.created_at).toLocaleTimeString()}</small></div><span className="tag">{k.status}</span></div>
    {k.lines.map(line=><div key={line.id} className="sale-line"><span>{line.productName} × {line.quantity}</span></div>)}
    <div className="quarantine-actions" style={{marginTop:8}}>
     {nextStatus[k.status]&&<ActionGuard action="bar.manage"><button type="button" disabled={busy} onClick={()=>advance(k)}>Mark {nextStatus[k.status].toLowerCase()}</button></ActionGuard>}
     {['NEW','ACCEPTED','PREPARING'].includes(k.status)&&<ActionGuard action="bar.manage"><button type="button" disabled={busy} onClick={()=>cancelKot(k)}>Cancel KOT</button></ActionGuard>}
    </div>
   </div>)}
  </div>
  {error&&<div className="pos-alert error" role="alert">{error}</div>}{message&&<div className="pos-alert success" role="status">{message}</div>}
  <p className="pos-disclaimer">Table and preparation updates are audited. A table cannot be closed while preparation tickets remain unfinished. This is a development/staging workflow; validate operating and licensing requirements before live service.</p>
 </section>;
}
