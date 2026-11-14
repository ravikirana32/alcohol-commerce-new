import { FormEvent, useCallback, useEffect, useState } from 'react';
import { ActionGuard } from '../ActionGuard';
type Outlet={id:string;name:string};
type Sale={id:string;receipt_number:string;outlet_id:string;grand_total:string|number;status:string;sold_at:string;refunded_total:string|number};
type SaleDetail=Sale&{lines:Array<{product_id:string;quantity_units:string|number;unit_price:string|number;line_total:string|number;id:string;restocked_quantity?:string|number}>;payments:Array<{method:string;amount:string|number;reference?:string}>;refunds:Array<{id:string;amount:string|number;reason:string;refund_method:string;restock:boolean;created_at:string}>};
const API=import.meta.env.VITE_API_BASE_URL??'http://localhost:8080';
const money=(v:number)=>`₹${v.toFixed(2)}`;
export default function RetailSalesWorkspace({token}:{token:string}){
 const [outlets,setOutlets]=useState<Outlet[]>([]),[outletId,setOutletId]=useState('');
 const [sales,setSales]=useState<Sale[]>([]),[sale,setSale]=useState<SaleDetail|null>(null);
 const [allocations,setAllocations]=useState<Record<string,number>>({});
 const [amount,setAmount]=useState(0),[reason,setReason]=useState(''),[method,setMethod]=useState('CASH'),[reference,setReference]=useState(''),[restock,setRestock]=useState(false);
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState('');
 const request=useCallback(async(url:string,init?:RequestInit)=>{
  const response=await fetch(`${API}${url}`,{...init,headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`,...((init?.headers??{}) as Record<string,string>)}});
  const payload=await response.json().catch(()=>({}));if(!response.ok)throw new Error(payload.error?.message??payload.error?.code??'Request failed');return payload;
 },[token]);
 const loadSales=useCallback(async(id:string)=>{
  if(!id)return;const p=await request(`/api/v1/retail/sales?outletId=${id}&limit=100`);setSales(p.data??[]);
 },[request]);
 const loadDetail=useCallback(async(id:string)=>{
  const p=await request(`/api/v1/retail/sales/${id}`);setSale(p.data);
 },[request]);
 useEffect(()=>{request('/api/v1/outlets').then(p=>{const rows=p.data??[];setOutlets(rows);if(rows[0])setOutletId(rows[0].id);}).catch(e=>setError(e.message));},[request]);
 useEffect(()=>{if(outletId)loadSales(outletId).catch(e=>setError(e.message));},[outletId,loadSales]);
 async function selectSale(id:string){setError('');try{await loadDetail(id);}catch(e){setError(e instanceof Error?e.message:'Unable to load sale');}}
 async function refund(e:FormEvent){
  e.preventDefault();if(!sale)return;setBusy(true);setError('');setMessage('');
  try{
   const p=await request(`/api/v1/retail/sales/${sale.id}/refunds`,{method:'POST',body:JSON.stringify({amount,reason,method,reference:reference||undefined,restock,restockAllocations:restock?sale.lines.filter(line=>(allocations[line.id]??0)>0).map(line=>({saleLineId:line.id,quantity:allocations[line.id]})):[]})});
   setMessage(`Refund recorded. Remaining refundable: ${money(Number(p.remainingRefundable??0))}.`);
   setAmount(0);setReason('');setReference('');setRestock(false);setAllocations({});
   await Promise.all([loadDetail(sale.id),loadSales(outletId)]);
  }catch(e){setError(e instanceof Error?e.message:'Refund failed');}finally{setBusy(false);}
 }
 const refunded=Number(sale?.refunded_total??sale?.refunds?.reduce((s,r)=>s+Number(r.amount),0)??0);
 const remaining=Math.max(0,Number(sale?.grand_total??0)-refunded);
 return <section className="sales-workspace">
  <div className="pos-heading"><div><span className="eyebrow">RETAIL SALES · DEVELOPMENT/STAGING</span><h2>Sales history and refunds</h2><p>Review completed sales, inspect tender allocations and record manager-authorised refunds.</p></div><span className="tag">RETAIL</span></div>
  <label className="shift-outlet">Outlet<select value={outletId} onChange={e=>{setOutletId(e.target.value);setSale(null);}}><option value="">Select outlet</option>{outlets.map(o=><option key={o.id} value={o.id}>{o.name}</option>)}</select></label>
  <div className="sales-layout">
   <div className="sales-list"><h3>Recent sales</h3>{sales.map(s=><button key={s.id} className={`sale-list-item ${sale?.id===s.id?'selected':''}`} onClick={()=>selectSale(s.id)}><strong>{s.receipt_number}</strong><span>{new Date(s.sold_at).toLocaleString()}</span><b>{money(Number(s.grand_total))}</b><small>{s.status}</small></button>)}{!sales.length&&<p className="muted">No sales found for this outlet.</p>}</div>
   <div className="sale-detail">
    {!sale&&<p className="muted">Select a sale to view its details.</p>}
    {sale&&<>
     <div className="sale-detail-head"><div><small>Receipt</small><h3>{sale.receipt_number}</h3></div><span className="tag">{sale.status}</span></div>
     <div className="sale-metrics"><div><small>Sale total</small><strong>{money(Number(sale.grand_total))}</strong></div><div><small>Refunded</small><strong>{money(refunded)}</strong></div><div><small>Remaining</small><strong>{money(remaining)}</strong></div></div>
     <h4>Items</h4>{sale.lines.map((line,i)=><div className="sale-line" key={i}><span>{line.product_id.slice(0,8)}… × {line.quantity_units} (returned {Number(line.restocked_quantity??0)})</span><strong>{money(Number(line.line_total))}</strong></div>)}
     <h4>Payments</h4>{sale.payments.map((p,i)=><div className="sale-line" key={i}><span>{p.method} {p.reference??''}</span><strong>{money(Number(p.amount))}</strong></div>)}
     <h4>Refund history</h4>{sale.refunds.map(r=><div className="sale-line" key={r.id}><span>{r.refund_method} · {r.reason} {r.restock?'· Restocked':''}</span><strong>{money(Number(r.amount))}</strong></div>)}{!sale.refunds.length&&<p className="muted">No refunds recorded.</p>}
     {remaining>0&&<form className="refund-form" onSubmit={refund}>
      <h3>Record refund</h3>
      <label>Refund amount<input type="number" min="0.01" max={remaining} step="0.01" required value={amount||''} onChange={e=>setAmount(Number(e.target.value)||0)}/></label>
      <label>Reason<input required minLength={3} maxLength={1000} value={reason} onChange={e=>setReason(e.target.value)}/></label>
      <label>Refund method<select value={method} onChange={e=>setMethod(e.target.value)}><option value="CASH">Cash</option><option value="UPI">UPI</option><option value="CARD">Card</option><option value="WALLET">Wallet</option><option value="OTHER">Other</option></select></label>
      <label>Reference (optional)<input value={reference} onChange={e=>setReference(e.target.value)}/></label>
      <label className="inline-check"><input type="checkbox" checked={restock} onChange={e=>setRestock(e.target.checked)}/> Restock returned goods (only after physical inspection)</label>
      {restock&&<div className="refund-restock-allocations"><h4>Exact returned quantities by SKU</h4>{sale.lines.map(line=>{const available=Math.max(0,Number(line.quantity_units)-Number(line.restocked_quantity??0));return <label key={line.id}>{line.product_id.slice(0,8)}… · available {available}<input type="number" min="0" max={available} step="0.001" value={allocations[line.id]||''} onChange={e=>setAllocations(current=>({...current,[line.id]:Math.min(available,Number(e.target.value)||0)}))}/></label>;})}</div>}
      <ActionGuard action="retail.refund"><button className="primary-button" disabled={busy||amount<=0||amount>remaining||reason.trim().length<3||(restock&&!sale.lines.some(line=>(allocations[line.id]??0)>0))}>Record refund</button></ActionGuard>
     </form>}
    </>}
   </div>
  </div>
  {error&&<div className="pos-alert error" role="alert">{error}</div>}{message&&<div className="pos-alert success" role="status">{message}</div>}
  <p className="pos-disclaimer">Refund access is enforced by API permissions. Restocking is a manager decision and must reflect a verified physical return. Refund value is not a substitute for SKU-level return allocation.</p>
 </section>;
}
