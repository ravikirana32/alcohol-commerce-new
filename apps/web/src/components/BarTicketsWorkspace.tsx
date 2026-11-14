import { FormEvent, useCallback, useEffect, useState } from 'react';
import { ActionGuard } from '../ActionGuard';
type Outlet={id:string;name:string};
type Ticket={id:string;ticket_number:string;outlet_id:string;grand_total:string|number;status:string;opened_at:string;refunded_total:string|number};
type QuarantineRow={id:string;ticket_number:string;volume_ml:number;disposition:'QUARANTINE_PENDING'|'DISPOSED'|'RELEASED_BY_COMPLIANCE';created_at:string;compliance_reference?:string|null;disposition_reason?:string|null};
type TicketDetail=Ticket&{lines:Array<{product_id:string;line_type:string;quantity:string|number;volume_ml:number|null;line_total:string|number;id:string;quarantined_volume_ml?:number|string;open_bottle_id?:string|null}>;payments:Array<{method:string;amount:string|number;reference?:string}>;refunds:Array<{id:string;amount:string|number;reason:string;refund_method:string;created_at:string}>};
const API=import.meta.env.VITE_API_BASE_URL??'http://localhost:8080';
const money=(n:number)=>`₹${n.toFixed(2)}`;
export default function BarTicketsWorkspace({token}:{token:string}){
 const [outlets,setOutlets]=useState<Outlet[]>([]),[outletId,setOutletId]=useState('');
 const [tickets,setTickets]=useState<Ticket[]>([]),[ticket,setTicket]=useState<TicketDetail|null>(null);
 const [quarantine,setQuarantine]=useState<QuarantineRow[]>([]);
 const [pegVolumes,setPegVolumes]=useState<Record<string,number>>({});
 const [amount,setAmount]=useState(0),[reason,setReason]=useState(''),[method,setMethod]=useState('CASH'),[reference,setReference]=useState('');
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState('');
 const request=useCallback(async(url:string,init?:RequestInit)=>{
  const response=await fetch(`${API}${url}`,{...init,headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`,...((init?.headers??{}) as Record<string,string>)}});
  const p=await response.json().catch(()=>({}));if(!response.ok)throw new Error(p.error?.message??p.error?.code??'Request failed');return p;
 },[token]);
 const load=useCallback(async(id:string)=>{if(!id)return;const p=await request(`/api/v1/bar/tickets?outletId=${id}&limit=100`);setTickets(p.data??[]);},[request]);
 const detail=useCallback(async(id:string)=>{const p=await request(`/api/v1/bar/tickets/${id}`);setTicket(p.data);},[request]);
 const loadQuarantine=useCallback(async()=>{const p=await request('/api/v1/bar/peg-quarantine');setQuarantine(p.data??[]);},[request]);
 useEffect(()=>{request('/api/v1/outlets').then(p=>{const rows=p.data??[];setOutlets(rows);if(rows[0])setOutletId(rows[0].id);}).catch(e=>setError(e.message));},[request]);
 useEffect(()=>{if(outletId)load(outletId).catch(e=>setError(e.message));},[outletId,load]);
 useEffect(()=>{loadQuarantine().catch(e=>setError(e.message));},[loadQuarantine]);
 async function disposeQuarantine(row:QuarantineRow,disposition:'DISPOSED'|'RELEASED_BY_COMPLIANCE'){
  const reason=window.prompt(disposition==='DISPOSED'?'Enter disposal reason:':'Enter compliance disposition reason:');if(!reason)return;
  const complianceReference=disposition==='RELEASED_BY_COMPLIANCE'?window.prompt('Enter documented compliance approval reference:'):undefined;
  if(disposition==='RELEASED_BY_COMPLIANCE'&&!complianceReference)return;
  setBusy(true);setError('');setMessage('');
  try{await request(`/api/v1/bar/peg-quarantine/${row.id}/disposition`,{method:'POST',body:JSON.stringify({disposition,reason,complianceReference})});setMessage(`Quarantine record updated: ${disposition}. Saleable bottle stock was not changed.`);await loadQuarantine();}
  catch(e){setError(e instanceof Error?e.message:'Could not update quarantine record');}finally{setBusy(false);}
 }
 async function refund(e:FormEvent){
  e.preventDefault();if(!ticket)return;setBusy(true);setError('');setMessage('');
  try{
   const p=await request(`/api/v1/bar/tickets/${ticket.id}/refunds`,{method:'POST',body:JSON.stringify({amount,reason,method,reference:reference||undefined,pegRestorations:ticket.lines.filter(line=>line.line_type==='PEG'&&(pegVolumes[line.id]??0)>0).map(line=>({ticketLineId:line.id,volumeMl:pegVolumes[line.id]}))})});
   setMessage(`Bar refund recorded. Remaining refundable: ${money(Number(p.remainingRefundable??0))}.`);
   setAmount(0);setReason('');setReference('');setPegVolumes({});
   await Promise.all([detail(ticket.id),load(outletId)]);
  }catch(e){setError(e instanceof Error?e.message:'Refund failed');}finally{setBusy(false);}
 }
 const refunded=Number(ticket?.refunded_total??ticket?.refunds?.reduce((s,r)=>s+Number(r.amount),0)??0);
 const remaining=Math.max(0,Number(ticket?.grand_total??0)-refunded);
 return <section className="sales-workspace">
  <div className="pos-heading"><div><span className="eyebrow">BAR TICKETS · DEVELOPMENT/STAGING</span><h2>Bar tickets and refunds</h2><p>Review paid tickets, peg measures, tender allocations and authorised refunds.</p></div><span className="tag">BAR</span></div>
  <label className="shift-outlet">Outlet<select value={outletId} onChange={e=>{setOutletId(e.target.value);setTicket(null);}}><option value="">Select outlet</option>{outlets.map(o=><option key={o.id} value={o.id}>{o.name}</option>)}</select></label>
  <div className="sales-layout">
   <div className="sales-list"><h3>Recent tickets</h3>{tickets.map(t=><button key={t.id} className={`sale-list-item ${ticket?.id===t.id?'selected':''}`} onClick={()=>detail(t.id).catch(e=>setError(e.message))}><strong>{t.ticket_number}</strong><span>{new Date(t.opened_at).toLocaleString()}</span><b>{money(Number(t.grand_total))}</b><small>{t.status}</small></button>)}{!tickets.length&&<p className="muted">No bar tickets found.</p>}</div>
   <div className="sale-detail">
    {!ticket&&<p className="muted">Select a ticket to inspect details.</p>}
    {ticket&&<>
     <div className="sale-detail-head"><div><small>Ticket</small><h3>{ticket.ticket_number}</h3></div><span className="tag">{ticket.status}</span></div>
     <div className="sale-metrics"><div><small>Ticket total</small><strong>{money(Number(ticket.grand_total))}</strong></div><div><small>Refunded</small><strong>{money(refunded)}</strong></div><div><small>Remaining</small><strong>{money(remaining)}</strong></div></div>
     <h4>Ticket lines</h4>{ticket.lines.map((line,i)=><div className="sale-line" key={i}><span>{line.product_id.slice(0,8)}… · {line.line_type} {line.volume_ml?`· ${line.volume_ml} ml (quarantined ${Number(line.quarantined_volume_ml??0)} ml)`:''} × {line.quantity}</span><strong>{money(Number(line.line_total))}</strong></div>)}
     <h4>Payments</h4>{ticket.payments.map((p,i)=><div className="sale-line" key={i}><span>{p.method} {p.reference??''}</span><strong>{money(Number(p.amount))}</strong></div>)}
     <h4>Refunds</h4>{ticket.refunds.map(r=><div className="sale-line" key={r.id}><span>{r.refund_method} · {r.reason}</span><strong>{money(Number(r.amount))}</strong></div>)}{!ticket.refunds.length&&<p className="muted">No refunds recorded.</p>}
     {remaining>0&&<form className="refund-form" onSubmit={refund}>
      <h3>Record bar refund</h3>
      <label>Refund amount<input type="number" min="0.01" max={remaining} step="0.01" required value={amount||''} onChange={e=>setAmount(Number(e.target.value)||0)}/></label>
      <label>Reason<input required minLength={3} value={reason} onChange={e=>setReason(e.target.value)}/></label>
      <label>Refund method<select value={method} onChange={e=>setMethod(e.target.value)}><option value="CASH">Cash</option><option value="UPI">UPI</option><option value="CARD">Card</option><option value="WALLET">Wallet</option><option value="OTHER">Other</option></select></label>
      <label>Reference<input value={reference} onChange={e=>setReference(e.target.value)}/></label>
      {ticket.lines.some(line=>line.line_type==='PEG')&&<div className="refund-restock-allocations"><h4>Returned peg volume to quarantine (optional)</h4>{ticket.lines.filter(line=>line.line_type==='PEG').map(line=>{const max=Math.max(0,Number(line.quantity)*Number(line.volume_ml??0)-Number(line.quarantined_volume_ml??0));return <label key={line.id}>Ticket line {line.id.slice(0,8)}… · remaining {max} ml<input type="number" min="0" max={max} step="1" value={pegVolumes[line.id]||''} onChange={e=>setPegVolumes(current=>({...current,[line.id]:Math.min(max,Math.floor(Number(e.target.value)||0))}))}/></label>;})}</div>}
      <ActionGuard action="bar.refund"><button className="primary-button" disabled={busy||amount<=0||amount>remaining||reason.trim().length<3}>Record refund</button></ActionGuard>
     </form>}
    </>}
   </div>
  </div>
  <section className="quarantine-workspace"><div className="sale-detail-head"><div><small>MANAGER CONTROL</small><h3>Returned peg volume quarantine</h3><p className="muted">Disposition is audited. No action in this screen adds liquid back to a saleable bottle.</p></div><button type="button" onClick={()=>loadQuarantine().catch(e=>setError(e.message))}>Refresh</button></div>
   {!quarantine.length&&<p className="muted">No peg-return quarantine records found.</p>}
   {quarantine.map(row=><div className="sale-line quarantine-row" key={row.id}><span><strong>{row.ticket_number}</strong> · {row.volume_ml} ml · {row.disposition}<small>{new Date(row.created_at).toLocaleString()}</small>{row.compliance_reference&&<small>Approval: {row.compliance_reference}</small>}</span>
    {row.disposition==='QUARANTINE_PENDING'&&<span className="quarantine-actions"><button type="button" disabled={busy} onClick={()=>disposeQuarantine(row,'DISPOSED')}>Record disposal</button><button type="button" disabled={busy} onClick={()=>disposeQuarantine(row,'RELEASED_BY_COMPLIANCE')}>Record compliance disposition</button></span>}
   </div>)}
  </section>
  {error&&<div className="pos-alert error" role="alert">{error}</div>}{message&&<div className="pos-alert success" role="status">{message}</div>}
  <p className="pos-disclaimer">Bar refunds are permission-controlled and audited. Returned/served liquid is recorded as quarantined and is never poured back into saleable stock; a manager must record its compliant disposition.</p>
 </section>;
}
