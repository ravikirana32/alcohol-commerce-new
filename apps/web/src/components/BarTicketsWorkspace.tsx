import { FormEvent, useCallback, useEffect, useState } from 'react';
import { ActionGuard } from '../ActionGuard';
type Outlet={id:string;name:string};
type Ticket={id:string;ticket_number:string;outlet_id:string;grand_total:string|number;status:string;opened_at:string;refunded_total:string|number};
type QuarantineRow={id:string;ticket_number:string;volume_ml:number;disposition:'QUARANTINE_PENDING'|'DISPOSED'|'RELEASED_BY_COMPLIANCE';created_at:string;compliance_reference?:string|null;disposition_reason?:string|null};
type TicketDetail=Ticket&{lines:Array<{product_id:string;line_type:string;quantity:string|number;volume_ml:number|null;line_total:string|number;id:string;quarantined_volume_ml?:number|string;open_bottle_id?:string|null}>;payments:Array<{method:string;amount:string|number;reference?:string}>;refunds:Array<{id:string;amount:string|number;reason:string;refund_method:string;created_at:string}>};
type PendingSplit={ticketId:string;idempotencyKey:string;lineIds:string[]};
type PendingLineEdit={ticketId:string;lineId:string;idempotencyKey:string;quantity:number;reason:string};
type TicketApproval={id:string;ticket_id:string;ticket_number:string;request_type:string;status:string;requested_by:string;created_at:string;request_payload:{idempotencyKey:string;amount?:number;reason:string;method?:string;reference?:string;pegRestorations?:Array<{ticketLineId:string;volumeMl:number}>}};
const API=import.meta.env.VITE_API_BASE_URL??'http://localhost:8080';
const money=(n:number)=>`₹${n.toFixed(2)}`;
export default function BarTicketsWorkspace({token}:{token:string}){
 const [outlets,setOutlets]=useState<Outlet[]>([]),[outletId,setOutletId]=useState('');
 const [tickets,setTickets]=useState<Ticket[]>([]),[ticket,setTicket]=useState<TicketDetail|null>(null);
 const [approvalRequests,setApprovalRequests]=useState<TicketApproval[]>([]);
 const [quarantine,setQuarantine]=useState<QuarantineRow[]>([]);
 const [pegVolumes,setPegVolumes]=useState<Record<string,number>>({});
 const [selectedSplitLines,setSelectedSplitLines]=useState<string[]>([]);
 const [pendingSplit,setPendingSplit]=useState<PendingSplit|null>(null);
 const [lineQuantities,setLineQuantities]=useState<Record<string,string>>({});
 const [pendingLineEdit,setPendingLineEdit]=useState<PendingLineEdit|null>(null);
 const [amount,setAmount]=useState(0),[reason,setReason]=useState(''),[method,setMethod]=useState('CASH'),[reference,setReference]=useState('');
 const [adjustmentType,setAdjustmentType]=useState<'DISCOUNT'|'COMP'|'TIP'|'SERVICE_CHARGE'>('DISCOUNT');
 const [adjustmentAmount,setAdjustmentAmount]=useState(0),[adjustmentReason,setAdjustmentReason]=useState('');
 const [customerConfirmed,setCustomerConfirmed]=useState(false);
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState('');
 const request=useCallback(async(url:string,init?:RequestInit)=>{
  const response=await fetch(`${API}${url}`,{...init,headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`,...((init?.headers??{}) as Record<string,string>)}});
  const p=await response.json().catch(()=>({}));if(!response.ok)throw Object.assign(new Error(p.error?.message??p.error?.code??'Request failed'),{status:response.status});return p;
 },[token]);
 const load=useCallback(async(id:string)=>{if(!id)return;const [p,a]=await Promise.all([request(`/api/v1/bar/tickets?outletId=${id}&limit=100`),request(`/api/v1/bar/ticket-approval-requests?outletId=${id}`)]);setTickets(p.data??[]);setApprovalRequests(a.data??[]);},[request]);
 const detail=useCallback(async(id:string)=>{const p=await request(`/api/v1/bar/tickets/${id}`);setTicket(p.data);setSelectedSplitLines([]);setPendingSplit(null);setPendingLineEdit(null);setLineQuantities(Object.fromEntries((p.data?.lines??[]).map((line:TicketDetail['lines'][number])=>[line.id,String(Number(line.quantity))])));},[request]);
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
   const approval=await request(`/api/v1/bar/tickets/${ticket.id}/approval-requests`,{method:'POST',body:JSON.stringify({
    type:'REFUND',idempotencyKey:crypto.randomUUID(),amount,reason,method,reference:reference||undefined,
    pegRestorations:ticket.lines.filter(line=>line.line_type==='PEG'&&(pegVolumes[line.id]??0)>0).map(line=>({ticketLineId:line.id,volumeMl:pegVolumes[line.id]}))
   })});
   setMessage(`Refund request ${approval.data.id.slice(0,8)} submitted for separate manager approval.`);
   await load(outletId);
  }catch(e){setError(e instanceof Error?e.message:'Refund failed');}finally{setBusy(false);}
 }
 async function requestTicketAdjustment(e:FormEvent){
  e.preventDefault();if(!ticket)return;
  setBusy(true);setError('');setMessage('');
  try{
   const result=await request(`/api/v1/bar/tickets/${ticket.id}/approval-requests`,{method:'POST',body:JSON.stringify({
    type:adjustmentType,idempotencyKey:crypto.randomUUID(),amount:adjustmentAmount,
    reason:adjustmentReason,customerConfirmed
   })});
   setMessage((adjustmentType==='TIP'||adjustmentType==='SERVICE_CHARGE')
    ?`${adjustmentType==='TIP'?'Tip':'Service charge'} recorded with customer confirmation.`
    :`${adjustmentType} request ${result.data.id.slice(0,8)} submitted for manager approval.`);
   setAdjustmentAmount(0);setAdjustmentReason('');setCustomerConfirmed(false);
   await Promise.all([detail(ticket.id),load(outletId)]);
  }catch(e){setError(e instanceof Error?e.message:'Could not submit ticket adjustment');}
  finally{setBusy(false);}
 }
 async function decideApproval(approval:TicketApproval,decision:'APPROVE'|'REJECT'){
  const decisionReason=window.prompt(`${decision==='APPROVE'?'Approval':'Rejection'} reason for ${approval.request_type.toLowerCase()}:`);
  if(!decisionReason?.trim())return;
  setBusy(true);setError('');setMessage('');
  try{
   await request(`/api/v1/bar/ticket-approval-requests/${approval.id}/decision`,{
    method:'POST',body:JSON.stringify({decision,reason:decisionReason.trim()})
   });
   setMessage(`${approval.request_type} request ${decision==='APPROVE'?'approved':'rejected'}.`);
   await load(outletId);
  }catch(e){setError(e instanceof Error?e.message:'Approval decision failed');}finally{setBusy(false);}
 }
 async function executeApprovedRefund(approval:TicketApproval){
  if(!ticket||approval.request_type!=='REFUND'||!approval.request_payload.method)return;
  setBusy(true);setError('');setMessage('');
  try{
   const p=approval.request_payload;
   const result=await request(`/api/v1/bar/tickets/${ticket.id}/refunds`,{method:'POST',body:JSON.stringify({
    approvalRequestId:approval.id,idempotencyKey:p.idempotencyKey,amount:p.amount,reason:p.reason,
    method:p.method,reference:p.reference,pegRestorations:p.pegRestorations??[]
   })});
   setMessage(`Bar refund recorded. Remaining refundable: ${money(Number(result.remainingRefundable??0))}.`);
   setAmount(0);setReason('');setReference('');setPegVolumes({});
   await Promise.all([detail(ticket.id),load(outletId)]);
  }catch(e){setError(e instanceof Error?e.message:'Refund execution failed');}finally{setBusy(false);}
 }
 async function splitSelectedItems(){
  if(!ticket||selectedSplitLines.length===0)return;
  const pending=pendingSplit?.ticketId===ticket.id?pendingSplit:{
   ticketId:ticket.id,idempotencyKey:crypto.randomUUID(),lineIds:[...selectedSplitLines]
  };
  if(!window.confirm(`Move ${pending.lineIds.length} selected item line(s) to a separate unpaid bill?`))return;
  setPendingSplit(pending);setBusy(true);setError('');setMessage('');
  try{
   const result=await request(`/api/v1/bar/tickets/${ticket.id}/split`,{
    method:'POST',body:JSON.stringify({idempotencyKey:pending.idempotencyKey,lineIds:pending.lineIds})
   });
   setPendingSplit(null);setSelectedSplitLines([]);
   setMessage(`Items split into bill ${result.data.ticket_number}.`);
   await Promise.all([detail(ticket.id),load(outletId)]);
  }catch(e){
   if(e&&typeof e==='object'&&'status' in e&&Number(e.status)<500)setPendingSplit(null);
   setError(e instanceof Error?e.message:'Could not split ticket items');
  }finally{setBusy(false);}
 }
 async function updateLineQuantity(line:TicketDetail['lines'][number]){
  if(!ticket)return;
  const quantity=Number(lineQuantities[line.id]);
  if(!Number.isInteger(quantity)||quantity<0||quantity>1000){setError('Quantity must be a whole number from zero to 1,000.');return;}
  if(quantity===Number(line.quantity)){setError('Enter a different quantity before saving.');return;}
  const reason=window.prompt('Reason for changing this unpaid packaged item quantity:');
  if(!reason?.trim())return;
  const pending:PendingLineEdit=pendingLineEdit?.ticketId===ticket.id&&pendingLineEdit.lineId===line.id
   ?pendingLineEdit:{ticketId:ticket.id,lineId:line.id,idempotencyKey:crypto.randomUUID(),quantity,reason:reason.trim()};
  setPendingLineEdit(pending);setBusy(true);setError('');setMessage('');
  try{
   await request(`/api/v1/bar/tickets/${ticket.id}/lines/${line.id}/quantity`,{
    method:'POST',body:JSON.stringify({idempotencyKey:pending.idempotencyKey,quantity:pending.quantity,reason:pending.reason})
   });
   setMessage(quantity===0?'Item removed from the unpaid ticket.':'Ticket item quantity updated.');
   await Promise.all([detail(ticket.id),load(outletId)]);
  }catch(e){
   if(e&&typeof e==='object'&&'status' in e&&Number(e.status)<500)setPendingLineEdit(null);
   setError(e instanceof Error?e.message:'Could not update ticket item');
  }finally{setBusy(false);}
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
     <h4>Ticket lines</h4>{ticket.lines.map((line)=><div className="sale-line" key={line.id}>
      <span>{ticket.status==='SENT'&&!ticket.payments.length&&!ticket.refunds.length&&ticket.lines.length>1&&<input
       aria-label={`Select item line ${line.id.slice(0,8)} for bill split`}
       type="checkbox"
       checked={selectedSplitLines.includes(line.id)}
       disabled={busy||Boolean(pendingSplit)}
       onChange={(event)=>setSelectedSplitLines((current)=>event.target.checked?[...current,line.id]:current.filter((id)=>id!==line.id))}
      />} {line.product_id.slice(0,8)}… · {line.line_type} {line.volume_ml?`· ${line.volume_ml} ml (quarantined ${Number(line.quarantined_volume_ml??0)} ml)`:''} × {line.quantity}</span>
      <strong>{money(Number(line.line_total))}</strong>
      {ticket.status==='SENT'&&!ticket.payments.length&&!ticket.refunds.length&&line.line_type==='PACKAGED'&&<div className="quarantine-actions">
       <label>Quantity<input aria-label={`Quantity for ticket line ${line.id.slice(0,8)}`} type="number" min="0" max="1000" step="1" value={lineQuantities[line.id]??String(Number(line.quantity))} disabled={busy||Boolean(pendingLineEdit)} onChange={event=>setLineQuantities(current=>({...current,[line.id]:event.target.value}))}/></label>
       <button type="button" disabled={busy} onClick={()=>void updateLineQuantity(line)}>Update item</button>
      </div>}
     </div>)}
     {ticket.status==='SENT'&&!ticket.payments.length&&!ticket.refunds.length&&ticket.lines.length>1&&<div className="refund-form">
      <p className="muted">Select complete item lines to move to a separate unpaid bill. At least one line must remain here; split is available before any payment.</p>
      <button type="button" disabled={busy||(!pendingSplit&&selectedSplitLines.length===0)} onClick={()=>void splitSelectedItems()}>
       {pendingSplit?.ticketId===ticket.id?'Retry item split':'Split selected items into new bill'}
      </button>
     </div>}
     <h4>Payments</h4>{ticket.payments.map((p,i)=><div className="sale-line" key={i}><span>{p.method} {p.reference??''}</span><strong>{money(Number(p.amount))}</strong></div>)}
     <h4>Refunds</h4>{ticket.refunds.map(r=><div className="sale-line" key={r.id}><span>{r.refund_method} · {r.reason}</span><strong>{money(Number(r.amount))}</strong></div>)}{!ticket.refunds.length&&<p className="muted">No refunds recorded.</p>}
     {approvalRequests.filter(a=>a.ticket_id===ticket.id).map(a=><div className="sale-line" key={a.id}>
      <span><strong>{a.request_type} {money(Number(a.request_payload.amount??0))} · {a.status}</strong><small>{a.request_payload.reason}</small></span>
      {a.status==='PENDING'&&<ActionGuard action="bar.approve"><span className="quarantine-actions">
       <button type="button" disabled={busy} onClick={()=>void decideApproval(a,'APPROVE')}>Approve {a.request_type.toLowerCase()}</button>
       <button type="button" disabled={busy} onClick={()=>void decideApproval(a,'REJECT')}>Reject {a.request_type.toLowerCase()}</button>
      </span></ActionGuard>}
      {a.status==='APPROVED'&&a.request_type==='REFUND'&&<ActionGuard action="bar.refund"><button type="button" disabled={busy} onClick={()=>void executeApprovedRefund(a)}>Execute approved refund</button></ActionGuard>}
     </div>)}
     {remaining>0&&ticket.status==='PAID'&&<form className="refund-form" onSubmit={refund}>
      <h3>Request bar refund</h3>
      <p className="muted">A different manager must approve before money/refund records can be posted.</p>
      <label>Refund amount<input type="number" min="0.01" max={remaining} step="0.01" required value={amount||''} onChange={e=>setAmount(Number(e.target.value)||0)}/></label>
      <label>Reason<input required minLength={3} value={reason} onChange={e=>setReason(e.target.value)}/></label>
      <label>Refund method<select value={method} onChange={e=>setMethod(e.target.value)}><option value="CASH">Cash</option><option value="UPI">UPI</option><option value="CARD">Card</option><option value="WALLET">Wallet</option><option value="OTHER">Other</option></select></label>
      <label>Reference<input value={reference} onChange={e=>setReference(e.target.value)}/></label>
      {ticket.lines.some(line=>line.line_type==='PEG')&&<div className="refund-restock-allocations"><h4>Returned peg volume to quarantine (optional)</h4>{ticket.lines.filter(line=>line.line_type==='PEG').map(line=>{const max=Math.max(0,Number(line.quantity)*Number(line.volume_ml??0)-Number(line.quarantined_volume_ml??0));return <label key={line.id}>Ticket line {line.id.slice(0,8)}… · remaining {max} ml<input type="number" min="0" max={max} step="1" value={pegVolumes[line.id]||''} onChange={e=>setPegVolumes(current=>({...current,[line.id]:Math.min(max,Math.floor(Number(e.target.value)||0))}))}/></label>;})}</div>}
      <ActionGuard action="bar.refund"><button className="primary-button" disabled={busy||amount<=0||amount>remaining||reason.trim().length<3}>Request refund approval</button></ActionGuard>
     </form>}
     {ticket.status==='SENT'&&!ticket.payments.length&&!ticket.refunds.length&&<form className="refund-form" onSubmit={requestTicketAdjustment}>
      <h3>Discount, comp, tip, or service charge</h3>
      <p className="muted">Every discount/comp needs separate manager approval. Tips and service charges are never automatic and require explicit customer confirmation.</p>
      <label>Adjustment type<select value={adjustmentType} onChange={event=>setAdjustmentType(event.target.value as typeof adjustmentType)}>
       <option value="DISCOUNT">Discount (manager approval)</option><option value="COMP">Comp (manager approval)</option>
       <option value="TIP">Tip (customer confirmed)</option><option value="SERVICE_CHARGE">Service charge (customer confirmed)</option>
      </select></label>
      <label>Amount<input type="number" min="0.01" step="0.01" required value={adjustmentAmount||''} onChange={event=>setAdjustmentAmount(Number(event.target.value)||0)}/></label>
      <label>Reason<input required minLength={3} maxLength={500} value={adjustmentReason} onChange={event=>setAdjustmentReason(event.target.value)}/></label>
      {(adjustmentType==='TIP'||adjustmentType==='SERVICE_CHARGE')&&<label><input type="checkbox" checked={customerConfirmed} onChange={event=>setCustomerConfirmed(event.target.checked)}/> Customer explicitly confirmed this amount</label>}
      <ActionGuard action="bar.checkout"><button className="secondary-button" disabled={busy||adjustmentAmount<=0||adjustmentReason.trim().length<3||((adjustmentType==='TIP'||adjustmentType==='SERVICE_CHARGE')&&!customerConfirmed)}>Submit adjustment</button></ActionGuard>
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
