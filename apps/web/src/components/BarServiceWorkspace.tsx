import { FormEvent, useCallback, useEffect, useState } from 'react';
import { ActionGuard } from '../ActionGuard';

type Outlet={id:string;name:string};
type SessionTicket={id:string;ticket_number:string;status:string;grand_total:string|number;paid_total:string|number;balance_due:string|number};
type Session={id:string;table_label:string;covers:number;status:'OPEN'|'HELD';opened_at:string;ticket_count:number;billed_total:string|number;paid_total:string|number;outstanding_total:string|number;pending_kot_count:number;tickets:SessionTicket[]};
type KotStation={id:string;station_code:string;name:string;is_default:boolean;status:string};
type Kot={id:string;ticket_id:string;ticket_number:string;status:string;station_id:string|null;station_code:string|null;station_name:string|null;table_label:string|null;session_table_label:string|null;created_at:string;lines:Array<{id:string;productName:string;quantity:number;instructions?:string|null}>};
type KotPrint={reprintId:string;printedAt:string;ticketNumber:string;tableLabel:string;stationName?:string;status:string;lines:Array<{product_name:string;quantity:string|number;instructions?:string|null}>};
type TicketApproval={id:string;ticket_id:string;ticket_number:string;request_type:string;status:string;requested_by:string;request_payload:{reason:string;amount?:number};created_at:string};
type Bottle={id:string;product_id:string;name:string;sku:string;remaining_ml:number;available_ml:number;status:string};
type BottleReservation={id:string;open_bottle_id:string;reserved_ml:number;consumed_ml:number;status:string;expires_at:string;reason:string};
type PaymentMethod='CASH'|'UPI'|'CARD'|'WALLET'|'OTHER';
type PaymentDraftLine={id:string;amount:string;method:PaymentMethod;reference:string};
type PaymentDraft={payments:PaymentDraftLine[];equalShares:string;pending?:{idempotencyKey:string;payments:Array<{method:PaymentMethod;amount:number;reference?:string}>}};
type RazorpayOrder={localOrderId:string;orderId:string;amount:number;currency:'INR';keyId:string};
type RazorpayCallback={localOrderId:string;razorpayOrderId:string;razorpayPaymentId:string;razorpaySignature:string};
type RazorpayCheckoutResult={razorpay_order_id:string;razorpay_payment_id:string;razorpay_signature:string};
type RazorpayOptions={key:string;amount:number;currency:string;name:string;description:string;order_id:string;handler:(result:RazorpayCheckoutResult)=>void;modal:{ondismiss:()=>void}};
declare global{interface Window{Razorpay?:new(options:RazorpayOptions)=>{open:()=>void}}}
const API=import.meta.env.VITE_API_BASE_URL??'http://localhost:8080';
const money=(n:number)=>`₹${n.toFixed(2)}`;
const nextStatus:Record<string,string>={NEW:'ACCEPTED',ACCEPTED:'PREPARING',PREPARING:'READY',READY:'SERVED'};
async function loadRazorpayCheckout():Promise<void>{
 if(window.Razorpay)return;
 await new Promise<void>((resolve,reject)=>{
  const existing=document.querySelector<HTMLScriptElement>('script[data-razorpay-checkout]');
  const script=existing??document.createElement('script');
  script.src='https://checkout.razorpay.com/v1/checkout.js';
  script.async=true;
  script.dataset.razorpayCheckout='true';
  script.addEventListener('load',()=>resolve(),{once:true});
  script.addEventListener('error',()=>{script.remove();reject(new Error('Could not load Razorpay Checkout. Check the network and retry.'));},{once:true});
  if(!existing)document.head.appendChild(script);
 });
 if(!window.Razorpay)throw new Error('Razorpay Checkout did not initialize.');
}
export default function BarServiceWorkspace({token}:{token:string}){
 const [outlets,setOutlets]=useState<Outlet[]>([]),[outletId,setOutletId]=useState('');
 const [sessions,setSessions]=useState<Session[]>([]),[kot,setKot]=useState<Kot[]>([]),[kotStations,setKotStations]=useState<KotStation[]>([]);
 const [stationCode,setStationCode]=useState(''),[stationName,setStationName]=useState(''),[stationDefault,setStationDefault]=useState(false);
 const [assignmentStationId,setAssignmentStationId]=useState(''),[assignmentProductId,setAssignmentProductId]=useState('');
 const [approvalRequests,setApprovalRequests]=useState<TicketApproval[]>([]);
 const [bottles,setBottles]=useState<Bottle[]>([]),[reservations,setReservations]=useState<BottleReservation[]>([]);
 const [reservationBottle,setReservationBottle]=useState(''),[reservationMl,setReservationMl]=useState(60),[reservationExpiry,setReservationExpiry]=useState(()=>{const d=new Date(Date.now()+60*60*1000);return new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,16);}),[reservationReason,setReservationReason]=useState('Table service reservation');
 const [adjustmentBottle,setAdjustmentBottle]=useState(''),[adjustmentMl,setAdjustmentMl]=useState(30),[adjustmentType,setAdjustmentType]=useState<'WASTAGE'|'BREAKAGE'|'COMPLIMENTARY'|'ADJUSTMENT'>('WASTAGE'),[adjustmentNotes,setAdjustmentNotes]=useState('Recorded bar inventory loss'),[adjustmentRequestKey,setAdjustmentRequestKey]=useState(()=>crypto.randomUUID().replaceAll('-',''));
 const [tableLabel,setTableLabel]=useState(''),[covers,setCovers]=useState(2);
 const [paymentDrafts,setPaymentDrafts]=useState<Record<string,PaymentDraft>>({});
 const [razorpayIdempotencyKeys,setRazorpayIdempotencyKeys]=useState<Record<string,string>>({});
 const [pendingRazorpayVerifications,setPendingRazorpayVerifications]=useState<Record<string,RazorpayCallback>>({});
 const [kotPrint,setKotPrint]=useState<KotPrint|null>(null);
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState('');
 const request=useCallback(async(url:string,init?:RequestInit)=>{
  const r=await fetch(`${API}${url}`,{...init,headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`,...((init?.headers??{}) as Record<string,string>)}});
  const p=await r.json().catch(()=>({}));if(!r.ok){const error=new Error(p.error?.message??p.error?.code??'Request failed') as Error&{status:number};error.status=r.status;throw error;}return p;
 },[token]);
 const refresh=useCallback(async(id:string)=>{
  if(!id)return;
  const [s,k,b,r,a,stations]=await Promise.all([request(`/api/v1/bar/table-sessions?outletId=${id}&includeHeld=true`),request(`/api/v1/bar/kot?outletId=${id}`),request(`/api/v1/bar/open-bottles?outletId=${id}`),request(`/api/v1/bar/bottle-reservations?outletId=${id}`),request(`/api/v1/bar/ticket-approval-requests?outletId=${id}`),request(`/api/v1/bar/kot/stations?outletId=${id}`)]);
  setSessions(s.data??[]);setKot(k.data??[]);setBottles(b.data??[]);setReservations(r.data??[]);setApprovalRequests(a.data??[]);setKotStations(stations.data??[]);if(!reservationBottle&&b.data?.[0])setReservationBottle(b.data[0].id);if(!adjustmentBottle&&b.data?.[0])setAdjustmentBottle(b.data[0].id);if(!assignmentStationId&&stations.data?.[0])setAssignmentStationId(stations.data[0].id);
 },[request,reservationBottle,adjustmentBottle,assignmentStationId]);
 useEffect(()=>{request('/api/v1/outlets').then(p=>{const rows=p.data??[];setOutlets(rows);if(rows[0])setOutletId(rows[0].id);}).catch(e=>setError(e.message));},[request]);
 useEffect(()=>{if(outletId)refresh(outletId).catch(e=>setError(e.message));},[outletId,refresh]);
 async function act(fn:()=>Promise<any>,success:string):Promise<boolean>{
  setBusy(true);setError('');setMessage('');
  try{await fn();setMessage(success);if(outletId)await refresh(outletId);return true;}
  catch(e){setError(e instanceof Error?e.message:'Operation failed');return false;}
  finally{setBusy(false);}
 }
 async function createKotStation(e:FormEvent){
  e.preventDefault();if(!outletId)return;
  await act(async()=>{
   const result=await request('/api/v1/bar/kot/stations',{method:'POST',body:JSON.stringify({outletId,stationCode, name:stationName,isDefault:stationDefault})});
   if(result.data?.id)setAssignmentStationId(result.data.id);
  },`Preparation station ${stationName} created.`);
  setStationCode('');setStationName('');setStationDefault(false);
 }
 async function assignKotProduct(e:FormEvent){
  e.preventDefault();if(!outletId||!assignmentStationId)return;
  await act(()=>request(`/api/v1/bar/kot/stations/${assignmentStationId}/products/${assignmentProductId}`,{method:'PUT',body:JSON.stringify({outletId})}),`Product assigned to ${kotStations.find(station=>station.id===assignmentStationId)?.name??'the preparation station'}.`);
  setAssignmentProductId('');
 }
 async function openTable(e:FormEvent){
  e.preventDefault();if(!outletId)return;
  await act(()=>request('/api/v1/bar/table-sessions',{method:'POST',body:JSON.stringify({outletId,tableLabel,covers})}),`Table ${tableLabel} opened.`);
  setTableLabel('');
 }
 async function transfer(s:Session){
  if(s.status!=='OPEN')return;
  const label=window.prompt(`Transfer ${s.table_label} to table:`,s.table_label);if(!label?.trim())return;
  const reason=window.prompt('Reason for table transfer (required):');if(!reason?.trim())return;
  await act(()=>request(`/api/v1/bar/table-sessions/${s.id}/transfer`,{method:'POST',body:JSON.stringify({tableLabel:label.trim(),reason})}),`Table transferred to ${label}.`);
 }
 async function merge(s:Session){
  if(s.status!=='OPEN')return;
  const target=sessions.find(x=>x.id!==s.id);if(!target)return;
  const targetId=window.prompt(`Enter destination table label to merge ${s.table_label} into:\n${sessions.filter(x=>x.id!==s.id).map(x=>x.table_label).join(', ')}`);
  const destination=sessions.find(x=>x.id!==s.id&&x.table_label.toLowerCase()===targetId?.trim().toLowerCase());
  if(!destination)return;
  const reason=window.prompt('Reason for table merge (required):');if(!reason?.trim())return;
  await act(()=>request(`/api/v1/bar/table-sessions/${s.id}/merge`,{method:'POST',body:JSON.stringify({targetSessionId:destination.id,reason})}),`Table ${s.table_label} merged into ${destination.table_label}.`);
 }
 async function close(s:Session){
  if(Number(s.outstanding_total)>0.001){setError(`Settle the remaining ${money(Number(s.outstanding_total))} before closing ${s.table_label}.`);return;}
  if(!window.confirm(`Close table ${s.table_label}? All KOTs must be served or cancelled.`))return;
  await act(()=>request(`/api/v1/bar/table-sessions/${s.id}/close`,{method:'POST',body:JSON.stringify({reason:'Table service completed'})}),`Table ${s.table_label} closed.`);
 }
 async function changeSessionStatus(s:Session){
  const status=s.status==='OPEN'?'HELD':'OPEN';
  const reason=window.prompt(status==='HELD'?'Reason for holding this tab:':'Reason for reopening this tab:');
  if(!reason?.trim())return;
  await act(
   ()=>request(`/api/v1/bar/table-sessions/${s.id}/status`,{method:'POST',body:JSON.stringify({status,reason})}),
   status==='HELD'?`Table ${s.table_label} put on hold.`:`Table ${s.table_label} reopened for orders.`
  );
 }
 async function settleTicket(s:Session,t:SessionTicket){
  const draft=paymentDrafts[t.id]??{payments:[{id:crypto.randomUUID(),amount:String(Number(t.balance_due).toFixed(2)),method:'CASH' as const,reference:''}],equalShares:'2'};
  const payments=draft.payments.map(line=>({method:line.method,amount:Number(line.amount),...(line.reference.trim()?{reference:line.reference.trim()}:{})}));
  if(!draft.pending&&(!payments.length||payments.some(payment=>!Number.isFinite(payment.amount)||payment.amount<=0))){setError('Every tender amount must be greater than zero.');return;}
  const pending=draft.pending??{
   idempotencyKey:crypto.randomUUID(),
   payments
  };
  setPaymentDrafts(current=>({...current,[t.id]:{...draft,pending}}));
  setBusy(true);setError('');setMessage('');
  try{
   const result=await request(`/api/v1/bar/tickets/${t.id}/payments`,{method:'POST',body:JSON.stringify(pending)});
   setPaymentDrafts(current=>{const next={...current};delete next[t.id];return next;});
   setMessage(`Payment recorded for ${t.ticket_number}. Remaining balance ${money(Number(result.remainingDue))}.`);
   try{await refresh(outletId);}catch(e){setError(`Payment was recorded, but table data could not refresh: ${e instanceof Error?e.message:'refresh failed'}`);}
  }catch(e){
   if(e&&typeof e==='object'&&'status' in e&&Number((e as {status:number}).status)>=400&&Number((e as {status:number}).status)<500){
    setPaymentDrafts(current=>({...current,[t.id]:{...draft,pending:undefined}}));
   }
   setError(e instanceof Error?e.message:'Payment failed. Retry the same payment request.');
  }
  finally{setBusy(false);}
 }
 async function verifyRazorpayPayment(ticket:SessionTicket,payload:RazorpayCallback){
  setBusy(true);setError('');setMessage('');
  try{
   const result=await request(`/api/v1/bar/tickets/${ticket.id}/razorpay-verify`,{method:'POST',body:JSON.stringify(payload)});
   setPendingRazorpayVerifications(current=>{const next={...current};delete next[ticket.id];return next;});
   setRazorpayIdempotencyKeys(current=>{const next={...current};delete next[ticket.id];return next;});
   setMessage(`Razorpay payment verified for ${ticket.ticket_number}. Remaining balance ${money(Number(result.data.remainingDue))}.`);
   try{await refresh(outletId);}catch(e){setError(`Payment was recorded, but table data could not refresh: ${e instanceof Error?e.message:'refresh failed'}`);}
  }catch(e){
   setError(`Payment may have completed at Razorpay, but confirmation was not recorded. Retry verification with the same payment details. ${e instanceof Error?e.message:''}`.trim());
  }finally{setBusy(false);}
 }
 async function payViaRazorpay(ticket:SessionTicket){
  setBusy(true);setError('');setMessage('');
  try{
   const idempotencyKey=razorpayIdempotencyKeys[ticket.id]??crypto.randomUUID();
   setRazorpayIdempotencyKeys(current=>({...current,[ticket.id]:idempotencyKey}));
   const result=await request(`/api/v1/bar/tickets/${ticket.id}/razorpay-order`,{
    method:'POST',body:JSON.stringify({idempotencyKey})
   });
   const order: RazorpayOrder=result.data;
   await loadRazorpayCheckout();
   const checkout=new window.Razorpay!({
    key:order.keyId,amount:order.amount,currency:order.currency,
    name:'Alcohol Commerce',description:`Bar tab ${ticket.ticket_number}`,
    order_id:order.orderId,
    handler:async response=>{
     const verification={localOrderId:order.localOrderId,razorpayOrderId:response.razorpay_order_id,razorpayPaymentId:response.razorpay_payment_id,razorpaySignature:response.razorpay_signature};
     setPendingRazorpayVerifications(current=>({...current,[ticket.id]:verification}));
     await verifyRazorpayPayment(ticket,verification);
    },
    modal:{ondismiss:()=>setBusy(false)}
   });
   checkout.open();
  }catch(e){
   setBusy(false);
   setError(e instanceof Error?e.message:'Could not start Razorpay payment.');
  }
 }
 function updatePaymentDraft(ticketId:string,current:PaymentDraft,update:(draft:PaymentDraft)=>PaymentDraft){
  setPaymentDrafts(rows=>({...rows,[ticketId]:update(rows[ticketId]??current)}));
 }
 function splitEvenly(ticketId:string,t:SessionTicket,draft:PaymentDraft){
  const count=Number(draft.equalShares);
  if(!Number.isInteger(count)||count<2||count>50){setError('Choose between 2 and 50 equal shares.');return;}
  const cents=Math.round(Number(t.balance_due)*100);
  const base=Math.floor(cents/count),remainder=cents%count;
  const payments=Array.from({length:count},(_,index)=>({
   id:crypto.randomUUID(),amount:((base+(index<remainder?1:0))/100).toFixed(2),method:'CASH' as const,reference:''
  }));
  setPaymentDrafts(rows=>({...rows,[ticketId]:{...draft,payments}}));
  setError('');
 }
 async function advance(k:Kot){
  const status=nextStatus[k.status];if(!status)return;
  await act(()=>request(`/api/v1/bar/kot/${k.id}/status`,{method:'POST',body:JSON.stringify({status})}),`KOT ${k.ticket_number} moved to ${status}.`);
 }
 async function cancelKot(k:Kot){
  const reason=window.prompt('Reason for requesting a separately approved ticket void. If preparation has started, consumed inventory will be recorded as wastage:');if(!reason?.trim())return;
  await act(()=>request(`/api/v1/bar/tickets/${k.ticket_id}/approval-requests`,{method:'POST',body:JSON.stringify({type:'VOID',idempotencyKey:crypto.randomUUID(),reason})}),`Void request for ${k.ticket_number} submitted for separate manager approval.`);
 }
 async function decideApproval(a:TicketApproval,decision:'APPROVE'|'REJECT'){
  const reason=window.prompt(`${decision==='APPROVE'?'Approval':'Rejection'} reason for ${a.request_type.toLowerCase()} request:`);if(!reason?.trim())return;
  await act(()=>request(`/api/v1/bar/ticket-approval-requests/${a.id}/decision`,{method:'POST',body:JSON.stringify({decision,reason})}),`${a.request_type} request ${decision==='APPROVE'?'approved':'rejected'}.`);
 }
 async function executeApprovedVoid(a:TicketApproval){
  await act(()=>request(`/api/v1/bar/tickets/${a.ticket_id}/void`,{method:'POST',body:JSON.stringify({
   approvalRequestId:a.id,idempotencyKey:`bar-void:${a.id}`
  })}),`Ticket ${a.ticket_number} voided; inventory disposition recorded.`);
 }
 async function reprintKot(k:Kot){
  const reason=window.prompt('Reason for reprinting this preparation ticket:');if(!reason?.trim())return;
  await act(async()=>{
   const result=await request(`/api/v1/bar/kot/${k.id}/reprints`,{method:'POST',body:JSON.stringify({reason})});
   setKotPrint(result.data);
   window.setTimeout(()=>window.print(),0);
  },`KOT ${k.ticket_number} reprint recorded.`);
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
  const saved=await act(()=>request('/api/v1/bar/peg-transactions',{method:'POST',headers:{'Idempotency-Key':adjustmentRequestKey},body:JSON.stringify({outletId,openBottleId:adjustmentBottle,volumeMl:adjustmentMl,type:adjustmentType,notes:adjustmentNotes})}),`${adjustmentType} of ${adjustmentMl} ml recorded.`);
  if(saved)setAdjustmentRequestKey(crypto.randomUUID().replaceAll('-',''));
 }
 return <section className="sales-workspace">
  <div className="pos-heading"><div><span className="eyebrow">BAR SERVICE · TABLES, TABS & KOT</span><h2>Tables and KOT queue</h2><p>Track open tabs across order rounds, record partial or mixed-tender settlements, and close only fully settled tables.</p></div><span className="tag">P586</span></div>
  <label className="shift-outlet">Outlet<select value={outletId} onChange={e=>setOutletId(e.target.value)}><option value="">Select outlet</option>{outlets.map(o=><option key={o.id} value={o.id}>{o.name}</option>)}</select></label>
  <div className="panel" style={{marginBottom:20}}>
   <div className="sale-detail-head"><div><small>TABLE MANAGEMENT</small><h3>Open a table session</h3></div><button type="button" disabled={busy} onClick={()=>outletId&&refresh(outletId).catch(e=>setError(e.message))}>Refresh</button></div>
   <ActionGuard action="bar.manage"><form className="pos-form" onSubmit={openTable}>
    <label>Table number / name<input required maxLength={40} value={tableLabel} onChange={e=>setTableLabel(e.target.value)} placeholder="e.g. T-04 / Garden 2"/></label>
    <label>Guests<input type="number" min="1" max="100" value={covers} onChange={e=>setCovers(Math.max(1,Math.min(100,Number(e.target.value)||1)))}/></label>
    <button className="primary-button" disabled={busy||!outletId||!tableLabel.trim()}>Open table</button>
   </form></ActionGuard>
   <h3>Active tables and held tabs ({sessions.length})</h3>
   {!sessions.length&&<p className="muted">No open or held table sessions for this outlet.</p>}
   {sessions.map(s=><div className="sale-line" key={s.id} style={{alignItems:'center',gap:12,flexWrap:'wrap'}}>
    <span><strong>{s.table_label} · {s.status}</strong><small>{s.covers} guests · {s.ticket_count} tickets · {s.pending_kot_count} pending KOT · {new Date(s.opened_at).toLocaleTimeString()}</small></span>
    <strong>{money(Number(s.billed_total))}<small>Paid {money(Number(s.paid_total))} · Due {money(Number(s.outstanding_total))}</small></strong>
    <span className="quarantine-actions">
     <ActionGuard action="bar.manage"><button type="button" disabled={busy} onClick={()=>void changeSessionStatus(s)}>{s.status==='OPEN'?'Hold tab':'Reopen tab'}</button></ActionGuard>
     <ActionGuard action="bar.manage"><button type="button" disabled={busy||s.status!=='OPEN'} onClick={()=>transfer(s)}>Transfer</button></ActionGuard>
     <ActionGuard action="bar.manage"><button type="button" disabled={busy||s.status!=='OPEN'||sessions.length<2} onClick={()=>merge(s)}>Merge</button></ActionGuard>
     <ActionGuard action="bar.manage"><button type="button" disabled={busy||s.pending_kot_count>0||Number(s.outstanding_total)>0.001} onClick={()=>close(s)}>Close table</button></ActionGuard>
    </span>
    {s.tickets?.map(t=>{
     const draft=paymentDrafts[t.id]??{payments:[{id:`${t.id}-payment-1`,amount:String(Number(t.balance_due).toFixed(2)),method:'CASH' as const,reference:''}],equalShares:'2'};
     const hasBalance=Number(t.balance_due)>0.001;
     return <div className="sale-line" key={t.id} style={{width:'100%',paddingLeft:14}}>
      <span><strong>{t.ticket_number} · {t.status}</strong><small>Total {money(Number(t.grand_total))} · Paid {money(Number(t.paid_total))} · Due {money(Number(t.balance_due))}</small></span>
      {hasBalance&&<form className="quarantine-actions" onSubmit={e=>{e.preventDefault();void settleTicket(s,t);}}>
       {draft.payments.map((line,index)=><div className="tender-row" key={line.id}>
        <input aria-label={`Payment amount ${index+1} for ${t.ticket_number}`} type="number" min="0.01" step="0.01" max={Number(t.balance_due)} value={line.amount} disabled={busy||Boolean(draft.pending)} onChange={e=>updatePaymentDraft(t.id,draft,value=>({...value,payments:value.payments.map(item=>item.id===line.id?{...item,amount:e.target.value}:item)}))}/>
        <select aria-label={`Payment method ${index+1} for ${t.ticket_number}`} value={line.method} disabled={busy||Boolean(draft.pending)} onChange={e=>updatePaymentDraft(t.id,draft,value=>({...value,payments:value.payments.map(item=>item.id===line.id?{...item,method:e.target.value as PaymentMethod}:item)}))}>
         <option value="CASH">Cash</option><option value="UPI">UPI</option><option value="CARD">Card</option><option value="WALLET">Wallet</option><option value="OTHER">Other</option>
        </select>
        <input aria-label={`Payment reference ${index+1} for ${t.ticket_number}`} maxLength={160} placeholder="Reference (optional)" value={line.reference} disabled={busy||Boolean(draft.pending)} onChange={e=>updatePaymentDraft(t.id,draft,value=>({...value,payments:value.payments.map(item=>item.id===line.id?{...item,reference:e.target.value}:item)}))}/>
        <button type="button" disabled={busy||Boolean(draft.pending)||draft.payments.length===1} onClick={()=>updatePaymentDraft(t.id,draft,value=>({...value,payments:value.payments.filter(item=>item.id!==line.id)}))}>Remove tender</button>
       </div>)}
       <button type="button" disabled={busy||Boolean(draft.pending)||draft.payments.length>=10} onClick={()=>updatePaymentDraft(t.id,draft,value=>({...value,payments:[...value.payments,{id:crypto.randomUUID(),amount:'0.00',method:'CASH',reference:''}]}))}>Add tender</button>
       <label>Equal shares<input aria-label={`Equal shares for ${t.ticket_number}`} type="number" min="2" max="50" step="1" value={draft.equalShares} disabled={busy||Boolean(draft.pending)} onChange={e=>updatePaymentDraft(t.id,draft,value=>({...value,equalShares:e.target.value}))}/></label>
       <button type="button" disabled={busy||Boolean(draft.pending)} onClick={()=>splitEvenly(t.id,t,draft)}>Split due evenly</button>
       <ActionGuard action="bar.checkout"><button type="submit" disabled={busy}>{draft.pending?'Retry payment':'Record payment'}</button></ActionGuard>
       <ActionGuard action="bar.checkout"><button type="button" disabled={busy} onClick={()=>void payViaRazorpay(t)}>Pay via Razorpay</button></ActionGuard>
       {pendingRazorpayVerifications[t.id]&&<ActionGuard action="bar.checkout"><button type="button" disabled={busy} onClick={()=>void verifyRazorpayPayment(t,pendingRazorpayVerifications[t.id])}>Retry Razorpay verification</button></ActionGuard>}
       {draft.pending&&<small>Retry preserves the same idempotency key and payment details.</small>}
      </form>}
     </div>;
    })}
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
   <div className="sale-detail-head"><div><small>PREPARATION WORKFLOW</small><h3>Kitchen / bar order tickets</h3><p className="muted">Tickets are split by configured preparation station; each station advances its own KOT.</p></div><span className="tag">{kot.filter(k=>!['SERVED','CANCELLED'].includes(k.status)).length} active</span></div>
   <ActionGuard action="bar.manage"><div className="pos-form">
    <form onSubmit={createKotStation}>
     <label>Station code<input required maxLength={30} value={stationCode} onChange={e=>setStationCode(e.target.value)}/></label>
     <label>Station name<input required maxLength={80} value={stationName} onChange={e=>setStationName(e.target.value)}/></label>
     <label>Default for unassigned products<input type="checkbox" checked={stationDefault} onChange={e=>setStationDefault(e.target.checked)}/></label>
     <button type="submit" disabled={busy||!outletId}>Add preparation station</button>
    </form>
    {kotStations.length>0&&<form onSubmit={assignKotProduct}>
     <label>Preparation station<select required value={assignmentStationId} onChange={e=>setAssignmentStationId(e.target.value)}><option value="">Select station</option>{kotStations.filter(station=>station.status==='ACTIVE').map(station=><option key={station.id} value={station.id}>{station.name} · {station.station_code}{station.is_default?' · default':''}</option>)}</select></label>
     <label>Product ID<input required pattern="[0-9a-fA-F-]{36}" value={assignmentProductId} onChange={e=>setAssignmentProductId(e.target.value)} placeholder="UUID from product details"/></label>
     <button type="submit" disabled={busy||!outletId||!assignmentStationId}>Route product</button>
    </form>}
   </div></ActionGuard>
   {!kot.length&&<p className="muted">No preparation tickets found.</p>}
   {kot.map(k=><div className="sale-line" key={k.id} style={{display:'block',padding:'14px 0'}}>
    <div className="sale-detail-head"><div><strong>{k.ticket_number} · {k.station_name??'Unassigned'}</strong><small>{k.session_table_label??k.table_label??'Walk-in'} · {new Date(k.created_at).toLocaleTimeString()}</small></div><span className="tag">{k.status}</span></div>
    {k.lines.map(line=><div key={line.id} className="sale-line"><span>{line.productName} × {line.quantity}</span></div>)}
    <div className="quarantine-actions" style={{marginTop:8}}>
     {nextStatus[k.status]&&<ActionGuard action="bar.manage"><button type="button" disabled={busy} onClick={()=>advance(k)}>Mark {nextStatus[k.status].toLowerCase()}</button></ActionGuard>}
     <ActionGuard action="bar.manage"><button type="button" disabled={busy} onClick={()=>reprintKot(k)}>Reprint KOT</button></ActionGuard>
     {!['SERVED','CANCELLED'].includes(k.status)&&!kot.some(other=>other.ticket_id===k.ticket_id&&['SERVED','CANCELLED'].includes(other.status))&&!approvalRequests.some(a=>a.ticket_id===k.ticket_id&&a.request_type==='VOID'&&['PENDING','APPROVED'].includes(a.status))&&<ActionGuard action="bar.refund"><button type="button" disabled={busy} onClick={()=>cancelKot(k)}>Request manager void</button></ActionGuard>}
    </div>
   </div>)}
  </div>
  {approvalRequests.length>0&&<div className="panel" style={{marginBottom:20}}>
   <div className="sale-detail-head"><div><small>DUAL CONTROL</small><h3>Ticket adjustment approvals</h3><p className="muted">Refunds, voids, discounts, and comps require a different manager to approve the request.</p></div><span className="tag">{approvalRequests.length} active</span></div>
   {approvalRequests.map(a=><div className="sale-line" key={a.id} style={{alignItems:'center',gap:12,flexWrap:'wrap'}}>
    <span><strong>{a.request_type} · {a.ticket_number}</strong><small>{a.request_payload.reason} · {a.status} · requested {new Date(a.created_at).toLocaleString()}</small></span>
    {a.status==='PENDING'&&<ActionGuard action="bar.approve"><span className="quarantine-actions">
     <button type="button" disabled={busy} onClick={()=>void decideApproval(a,'APPROVE')}>Approve</button>
     <button type="button" disabled={busy} onClick={()=>void decideApproval(a,'REJECT')}>Reject</button>
    </span></ActionGuard>}
    {a.status==='APPROVED'&&a.request_type==='VOID'&&<ActionGuard action="bar.refund">
     <button type="button" disabled={busy} onClick={()=>void executeApprovedVoid(a)}>Execute approved void</button>
    </ActionGuard>}
   </div>)}
  </div>}
  {error&&<div className="pos-alert error" role="alert">{error}</div>}{message&&<div className="pos-alert success" role="status">{message}</div>}
  <p className="pos-disclaimer">Tab rounds consume stock and create KOTs when sent. All ticket balances and KOTs must be complete before closing a table. Each recorded payment is audited and retry-safe. This is a development/staging workflow; validate operating and licensing requirements before live service.</p>
  {kotPrint&&<section className="kot-print-sheet" aria-label="KOT reprint preview">
   <h2>BAR KOT · REPRINT</h2>
   <p>{kotPrint.ticketNumber} · {kotPrint.tableLabel} · {kotPrint.stationName??'Unassigned'}</p>
   <p>{new Date(kotPrint.printedAt).toLocaleString()} · {kotPrint.status}</p>
   <hr/>
   {kotPrint.lines.map((line,index)=><p key={`${line.product_name}-${index}`}>
    {line.product_name} × {line.quantity}{line.instructions?` — ${line.instructions}`:''}
   </p>)}
   <small>Reprint {kotPrint.reprintId}</small>
  </section>}
 </section>;
}
