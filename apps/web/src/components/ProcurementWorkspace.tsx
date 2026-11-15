import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { ActionGuard } from '../ActionGuard';

const API=import.meta.env.VITE_API_BASE_URL??'http://localhost:8080';
type Supplier={id:string;name:string;supplier_code:string;status:string;gstin?:string};
type Outlet={id:string;name:string};
type Product={id:string;name:string;sku:string};
type PO={id:string;po_number:string;status:string;approval_status?:string;supplier_name?:string;supplier_id?:string;outlet_id?:string;lines?:POLine[]};
type POLine={id:string;product_id:string;product_name:string;ordered_units:number;received_units:number;unit_cost:number};
type Receipt={id:string;receipt_number:string;purchase_order_id:string;po_number:string;status:string};
type MatchRun={id:string;goodsReceiptId:string;goodsReceiptIds:string[];status:string;quantityVariance:number;valueVariance:number;purchaseOrderQuantityVariance:number;purchaseOrderValueVariance:number;created_by:string};
type Invoice={id:string;invoice_number:string;invoice_date:string;due_date?:string;total_amount:number;status:string;supplier_name:string;po_number:string;purchase_order_id:string;created_by:string;lines:unknown[];match_runs:MatchRun[]};
type InvoiceLine={productId:string;quantityUnits:string;unitCost:string};
type POEntryLine={productId:string;orderedUnits:string;unitCost:string};
type ReceiptEntryLine={purchaseOrderLineId:string;productId:string;productName:string;remainingUnits:number;receivedUnits:string;acceptedUnits:string;unitCost:string;batchNumber:string;expiryDate:string};

export default function ProcurementWorkspace({token}:{token:string}){
 const [suppliers,setSuppliers]=useState<Supplier[]>([]);
 const [outlets,setOutlets]=useState<Outlet[]>([]);
 const [products,setProducts]=useState<Product[]>([]);
 const [orders,setOrders]=useState<PO[]>([]);
 const [receipts,setReceipts]=useState<Receipt[]>([]);
 const [invoices,setInvoices]=useState<Invoice[]>([]);
 const [invoiceLines,setInvoiceLines]=useState<InvoiceLine[]>([]);
 const [selectedPO,setSelectedPO]=useState('');
 const [poLines,setPOLines]=useState<POLine[]>([]);
 const [error,setError]=useState('');
 const [message,setMessage]=useState('');
 const [busy,setBusy]=useState(false);
 const [name,setName]=useState('');
 const [code,setCode]=useState('');
 const [gstin,setGstin]=useState('');
 const [invoiceNumber,setInvoiceNumber]=useState('');
 const [invoiceDate,setInvoiceDate]=useState(new Date().toISOString().slice(0,10));
 const [dueDate,setDueDate]=useState('');
 const [taxAmount,setTaxAmount]=useState('0');
 const [varianceReason,setVarianceReason]=useState<Record<string,string>>({});
 const [matchKeys,setMatchKeys]=useState<Record<string,string>>({});
 const [poOutletId,setPOOutletId]=useState('');
 const [poSupplierId,setPOSupplierId]=useState('');
 const [poNumber,setPONumber]=useState('');
 const [poExpectedAt,setPOExpectedAt]=useState('');
 const [poEntryLines,setPOEntryLines]=useState<POEntryLine[]>([{productId:'',orderedUnits:'1',unitCost:'0'}]);
 const [receivingPO,setReceivingPO]=useState<PO|null>(null);
 const [receivingLines,setReceivingLines]=useState<ReceiptEntryLine[]>([]);
 const [receiptNumber,setReceiptNumber]=useState('');
 const [receiptNotes,setReceiptNotes]=useState('');
 const [receiptAttempt,setReceiptAttempt]=useState<{fingerprint:string;key:string}|null>(null);

 const headers={'Content-Type':'application/json',Authorization:`Bearer ${token}`};
 const request=useCallback(async(path:string,init:RequestInit={})=>{
  const response=await fetch(`${API}/api/v1${path}`,{...init,headers:{...headers,...((init.headers??{}) as Record<string,string>)}});
  const payload=await response.json().catch(()=>({}));
  if(!response.ok)throw new Error(payload.error?.message??payload.error?.code??'Request failed');
  return payload;
 },[token]);
 const load=useCallback(async()=>{
  try{
   const [s,p,r,i,o,c]=await Promise.all([
    request('/procurement/suppliers'),request('/procurement/purchase-orders'),
    request('/procurement/goods-receipts'),request('/procurement/supplier-invoices'),
    request('/outlets'),request('/catalogue/products?status=ACTIVE')
   ]);
   setSuppliers(s.data??[]);setOrders(p.data??[]);setReceipts(r.data??[]);setInvoices(i.data??[]);
   setOutlets(o.data??[]);setProducts(c.data??[]);
   setPOOutletId(current=>current||(o.data?.[0]?.id??''));
   setPOSupplierId(current=>current||(s.data?.find((row:Supplier)=>row.status==='ACTIVE')?.id??''));
  }catch(e){setError(e instanceof Error?e.message:'Unable to load procurement');}
 },[request]);
 useEffect(()=>{void load();},[load]);

 async function createSupplier(){
  setBusy(true);setError('');setMessage('');
  try{
   await request('/procurement/suppliers',{method:'POST',body:JSON.stringify({name,supplierCode:code,gstin:gstin||undefined})});
   setName('');setCode('');setGstin('');setMessage('Supplier added.');await load();
  }catch(e){setError(e instanceof Error?e.message:'Supplier creation failed');}finally{setBusy(false);}
 }
 async function act(poId:string,action:'submit'|'review',body:Record<string,string>={}){
  setBusy(true);setError('');setMessage('');
  try{await request(`/procurement/purchase-orders/${poId}/${action}`,{method:'POST',body:JSON.stringify(body)});setMessage('Purchase order updated.');await load();}
  catch(e){setError(e instanceof Error?e.message:'Purchase order action failed');}finally{setBusy(false);}
 }
 function changePOEntry(index:number,patch:Partial<POEntryLine>){
  setPOEntryLines(rows=>rows.map((row,i)=>i===index?{...row,...patch}:row));
 }
 async function createPO(event:FormEvent){
  event.preventDefault();setBusy(true);setError('');setMessage('');
  try{
   const created=await request('/procurement/purchase-orders',{method:'POST',body:JSON.stringify({
    outletId:poOutletId,supplierId:poSupplierId,poNumber,expectedAt:poExpectedAt||undefined,
    lines:poEntryLines.map(line=>({productId:line.productId,orderedUnits:Number(line.orderedUnits),unitCost:Number(line.unitCost)}))
   })});
   setPONumber('');setPOExpectedAt('');setPOEntryLines([{productId:'',orderedUnits:'1',unitCost:'0'}]);
   setMessage(`Draft purchase order ${created.data.po_number} created.`);await load();
  }catch(e){setError(e instanceof Error?e.message:'Purchase order creation failed');}finally{setBusy(false);}
 }
 async function openReceipt(po:PO){
  setError('');setMessage('');
  try{
   const result=await request(`/procurement/purchase-orders/${po.id}`);
   const rows:POLine[]=result.data.lines??[];
   const remaining=rows.filter(line=>Number(line.ordered_units)>Number(line.received_units)).map(line=>{
    const available=Number(line.ordered_units)-Number(line.received_units);
    return {purchaseOrderLineId:line.id,productId:line.product_id,productName:line.product_name,
     remainingUnits:available,receivedUnits:String(available),acceptedUnits:String(available),
     unitCost:String(line.unit_cost),batchNumber:'',expiryDate:''};
   });
   if(!remaining.length){setError('This purchase order has no remaining quantities to receive.');return;}
   setReceivingPO(result.data);setReceivingLines(remaining);
   setReceiptNumber(`GRN-${Date.now()}`);setReceiptNotes('');setReceiptAttempt(null);
  }catch(e){setError(e instanceof Error?e.message:'Unable to load purchase order for receiving');}
 }
 function changeReceiptLine(index:number,patch:Partial<ReceiptEntryLine>){
  setReceivingLines(rows=>rows.map((row,i)=>i===index?{...row,...patch}:row));
 }
 async function postReceipt(event:FormEvent){
  event.preventDefault();if(!receivingPO)return;
  const body={receiptNumber,notes:receiptNotes||undefined,lines:receivingLines.map(line=>({
   purchaseOrderLineId:line.purchaseOrderLineId,receivedUnits:Number(line.receivedUnits),
   acceptedUnits:Number(line.acceptedUnits),unitCost:Number(line.unitCost),
   batchNumber:line.batchNumber||undefined,expiryDate:line.expiryDate||undefined
  }))};
  const fingerprint=JSON.stringify(body);
  const attempt=receiptAttempt?.fingerprint===fingerprint?receiptAttempt:{fingerprint,key:crypto.randomUUID()};
  if(attempt!==receiptAttempt)setReceiptAttempt(attempt);
  setBusy(true);setError('');setMessage('');
  try{
   const posted=await request(`/procurement/purchase-orders/${receivingPO.id}/receipts`,{
    method:'POST',headers:{'Idempotency-Key':attempt.key},body:JSON.stringify(body)
   });
   setMessage(`Goods receipt ${posted.data.receipt_number} posted; accepted stock is available and batch evidence is recorded.`);
   setReceivingPO(null);setReceivingLines([]);setReceiptAttempt(null);await load();
  }catch(e){setError(e instanceof Error?e.message:'Goods receipt posting failed');}finally{setBusy(false);}
 }
 async function choosePO(poId:string){
  setSelectedPO(poId);setPOLines([]);setInvoiceLines([]);
  if(!poId)return;
  try{
   const result=await request(`/procurement/purchase-orders/${poId}`);
   const rows:POLine[]=result.data.lines??[];
   setPOLines(rows);
   setInvoiceLines(rows.filter(line=>Number(line.received_units)>0).map(line=>({
    productId:line.product_id,
    quantityUnits:String(line.received_units),
    unitCost:String(line.unit_cost)
   })));
  }catch(e){setError(e instanceof Error?e.message:'Unable to load purchase order lines');}
 }
 function changeLine(index:number,patch:Partial<InvoiceLine>){
  setInvoiceLines(rows=>rows.map((row,i)=>i===index?{...row,...patch}:row));
 }
 async function createInvoice(event:FormEvent){
  event.preventDefault();setBusy(true);setError('');setMessage('');
  try{
   await request('/procurement/supplier-invoices',{method:'POST',body:JSON.stringify({
    purchaseOrderId:selectedPO,invoiceNumber,invoiceDate,dueDate:dueDate||undefined,
    taxAmount:Number(taxAmount),lines:invoiceLines.map(row=>({
     productId:row.productId,quantityUnits:Number(row.quantityUnits),unitCost:Number(row.unitCost)
    }))
   })});
   setInvoiceNumber('');setDueDate('');setTaxAmount('0');setInvoiceLines([]);
   setMessage('Supplier invoice recorded. No payment has been posted.');await load();
  }catch(e){setError(e instanceof Error?e.message:'Invoice recording failed');}finally{setBusy(false);}
 }
 async function matchInvoice(invoice:Invoice,receiptIds:string[]){
  setBusy(true);setError('');setMessage('');
  try{
   const requestId=`${invoice.id}:${receiptIds.slice().sort().join(',')}`;
   const idempotencyKey=matchKeys[requestId]??crypto.randomUUID();
   if(!matchKeys[requestId])setMatchKeys(current=>({...current,[requestId]:idempotencyKey}));
   await request(`/procurement/supplier-invoices/${invoice.id}/match`,{
    method:'POST',headers:{'Idempotency-Key':idempotencyKey},
    body:JSON.stringify({goodsReceiptIds:receiptIds,tolerancePercent:0})
   });
   setMatchKeys(current=>{const next={...current};delete next[requestId];return next;});
   setMessage(`Invoice ${invoice.invoice_number} matched against receipt evidence.`);await load();
  }catch(e){setError(e instanceof Error?e.message:'Invoice matching failed');}finally{setBusy(false);}
 }
 async function decide(run:MatchRun,decision:'ACCEPTED'|'REJECTED'){
  const reason=varianceReason[run.id]?.trim()??'';
  if(reason.length<3){setError('Enter a reason of at least 3 characters to review a variance.');return;}
  setBusy(true);setError('');setMessage('');
  try{
   await request(`/procurement/invoice-match-runs/${run.id}/decision`,{method:'POST',body:JSON.stringify({decision,reason})});
   setMessage(`Invoice variance ${decision.toLowerCase()}.`);await load();
  }catch(e){setError(e instanceof Error?e.message:'Invoice decision failed');}finally{setBusy(false);}
 }

 const invoiceablePOs=orders.filter(po=>po.approval_status==='APPROVED'&&['SUBMITTED','PART_RECEIVED','RECEIVED'].includes(po.status));
 const eligibleReceiptPOs=orders.filter(po=>po.approval_status==='APPROVED'&&['SUBMITTED','PART_RECEIVED'].includes(po.status));
 return <div className="workspace-stack">
  <section className="panel">
   <div className="panel-head"><div><h2>Supplier directory</h2><p>Manage approved supplier records for this organisation</p></div></div>
   <div className="form-grid">
    <label>Supplier name<input value={name} onChange={e=>setName(e.target.value)} placeholder="Supplier legal / trading name"/></label>
    <label>Supplier code<input value={code} onChange={e=>setCode(e.target.value)} placeholder="SUP-001"/></label>
    <label>GSTIN (optional)<input value={gstin} onChange={e=>setGstin(e.target.value.toUpperCase())} maxLength={15} placeholder="15-character GSTIN"/></label>
    <ActionGuard action="procurement.manage"><button className="primary-button" disabled={busy||name.trim().length<2||code.trim().length<2} onClick={()=>void createSupplier()}>Add supplier</button></ActionGuard>
   </div>
   <div className="table-wrap"><table><thead><tr><th>Supplier</th><th>Code</th><th>GSTIN</th><th>Status</th></tr></thead><tbody>
    {suppliers.map(s=><tr key={s.id}><td>{s.name}</td><td>{s.supplier_code}</td><td>{s.gstin??'—'}</td><td>{s.status}</td></tr>)}
    {!suppliers.length&&<tr><td colSpan={4}>No suppliers added yet.</td></tr>}
   </tbody></table></div>
  </section>
  <section className="panel">
   <div className="panel-head"><div><h2>Purchase order control</h2><p>Create, submit, approve, and receive supplier orders</p></div><button className="secondary-button" onClick={()=>void load()}>Refresh</button></div>
   <ActionGuard action="procurement.manage">
    <form onSubmit={createPO} className="form-grid">
     <label>Outlet<select required value={poOutletId} onChange={e=>setPOOutletId(e.target.value)}><option value="">Select outlet</option>{outlets.map(outlet=><option key={outlet.id} value={outlet.id}>{outlet.name}</option>)}</select></label>
     <label>Supplier<select required value={poSupplierId} onChange={e=>setPOSupplierId(e.target.value)}><option value="">Select supplier</option>{suppliers.filter(s=>s.status==='ACTIVE').map(s=><option key={s.id} value={s.id}>{s.name} · {s.supplier_code}</option>)}</select></label>
     <label>PO number<input required minLength={2} maxLength={60} value={poNumber} onChange={e=>setPONumber(e.target.value)}/></label>
     <label>Expected delivery date<input type="date" value={poExpectedAt} onChange={e=>setPOExpectedAt(e.target.value)}/></label>
     {poEntryLines.map((line,index)=><div className="form-grid" key={index}>
      <label>Product<select required value={line.productId} onChange={e=>changePOEntry(index,{productId:e.target.value})}><option value="">Select product</option>{products.filter(product=>!poEntryLines.some((other,i)=>i!==index&&other.productId===product.id)).map(product=><option key={product.id} value={product.id}>{product.name} · {product.sku}</option>)}</select></label>
      <label>Ordered units<input type="number" min="0.001" step="0.001" required value={line.orderedUnits} onChange={e=>changePOEntry(index,{orderedUnits:e.target.value})}/></label>
      <label>Unit cost<input type="number" min="0" step="0.0001" required value={line.unitCost} onChange={e=>changePOEntry(index,{unitCost:e.target.value})}/></label>
      {poEntryLines.length>1&&<button type="button" className="secondary-button" onClick={()=>setPOEntryLines(rows=>rows.filter((_,i)=>i!==index))}>Remove line</button>}
     </div>)}
     <button type="button" className="secondary-button" onClick={()=>setPOEntryLines(rows=>[...rows,{productId:'',orderedUnits:'1',unitCost:'0'}])}>Add PO line</button>
     <button className="primary-button" disabled={busy||!poOutletId||!poSupplierId||!poNumber.trim()||poEntryLines.some(line=>!line.productId||Number(line.orderedUnits)<=0||Number(line.unitCost)<0)}>Create draft PO</button>
    </form>
   </ActionGuard>
   <div className="table-wrap"><table><thead><tr><th>PO number</th><th>Supplier</th><th>PO status</th><th>Approval</th><th>Actions</th></tr></thead><tbody>
    {orders.map(p=><tr key={p.id}><td>{p.po_number}</td><td>{p.supplier_name??'—'}</td><td>{p.status}</td><td>{p.approval_status??'Not submitted'}</td><td>
     {p.status==='DRAFT'?<ActionGuard action="procurement.manage"><button className="secondary-button" disabled={busy} onClick={()=>void act(p.id,'submit')}>Submit</button></ActionGuard>:p.approval_status==='PENDING'?<ActionGuard action="procurement.approve"><><button className="secondary-button" disabled={busy} onClick={()=>void act(p.id,'review',{decision:'APPROVED'})}>Approve</button> <button className="secondary-button" disabled={busy} onClick={()=>void act(p.id,'review',{decision:'REJECTED'})}>Reject</button></></ActionGuard>:null}
     {eligibleReceiptPOs.some(po=>po.id===p.id)&&<ActionGuard action="procurement.manage"><button className="secondary-button" disabled={busy} onClick={()=>void openReceipt(p)}>Receive goods</button></ActionGuard>}
    </td></tr>)}
    {!orders.length&&<tr><td colSpan={5}>No purchase orders available.</td></tr>}
   </tbody></table></div>
   {receivingPO&&<form onSubmit={postReceipt} className="form-grid">
    <h3>Post goods receipt for {receivingPO.po_number}</h3>
    <label>Receipt number<input required minLength={2} maxLength={60} value={receiptNumber} onChange={e=>setReceiptNumber(e.target.value)}/></label>
    <label>Notes<input maxLength={1000} value={receiptNotes} onChange={e=>setReceiptNotes(e.target.value)}/></label>
    {receivingLines.map((line,index)=><div className="form-grid" key={line.purchaseOrderLineId}>
     <label>Product<input readOnly value={line.productName}/></label>
     <label>Remaining PO units<input readOnly value={line.remainingUnits}/></label>
     <label>Received units<input type="number" min="0.001" max={line.remainingUnits} step="0.001" required value={line.receivedUnits} onChange={e=>changeReceiptLine(index,{receivedUnits:e.target.value})}/></label>
     <label>Accepted units<input type="number" min="0" max={line.receivedUnits||line.remainingUnits} step="0.001" required value={line.acceptedUnits} onChange={e=>changeReceiptLine(index,{acceptedUnits:e.target.value})}/></label>
     <label>Actual unit cost<input type="number" min="0" step="0.0001" required value={line.unitCost} onChange={e=>changeReceiptLine(index,{unitCost:e.target.value})}/></label>
     <label>Supplier batch / lot<input required={Number(line.acceptedUnits)>0} maxLength={80} value={line.batchNumber} onChange={e=>changeReceiptLine(index,{batchNumber:e.target.value})}/></label>
     <label>Expiry date<input type="date" value={line.expiryDate} onChange={e=>changeReceiptLine(index,{expiryDate:e.target.value})}/></label>
    </div>)}
    <p className="muted">Posting immediately updates stock and records accepted quantities in FEFO batches. Rejected quantities are not stocked.</p>
    <button className="primary-button" disabled={busy||!receiptNumber.trim()||receivingLines.some(line=>Number(line.receivedUnits)<=0||Number(line.receivedUnits)>line.remainingUnits||Number(line.acceptedUnits)<0||Number(line.acceptedUnits)>Number(line.receivedUnits)||(Number(line.acceptedUnits)>0&&!line.batchNumber.trim()))}>Post goods receipt</button>
    <button type="button" className="secondary-button" disabled={busy} onClick={()=>{setReceivingPO(null);setReceivingLines([]);setReceiptAttempt(null);}}>Cancel</button>
   </form>}
  </section>
  <section className="panel">
   <div className="panel-head"><div><h2>Supplier invoice matching</h2><p>Record supplier invoices against approved purchase orders and compare to posted goods receipts. This does not post payments.</p></div></div>
   <ActionGuard action="procurement.manage">
    <form onSubmit={createInvoice} className="form-grid">
     <label>Approved purchase order<select required value={selectedPO} onChange={e=>void choosePO(e.target.value)}><option value="">Select PO</option>{invoiceablePOs.map(po=><option key={po.id} value={po.id}>{po.po_number} · {po.supplier_name} · {po.status}</option>)}</select></label>
     <label>Supplier invoice number<input required maxLength={100} value={invoiceNumber} onChange={e=>setInvoiceNumber(e.target.value)}/></label>
     <label>Invoice date<input type="date" required value={invoiceDate} onChange={e=>setInvoiceDate(e.target.value)}/></label>
     <label>Due date<input type="date" value={dueDate} onChange={e=>setDueDate(e.target.value)}/></label>
     <label>Tax amount<input type="number" min="0" step="0.01" value={taxAmount} onChange={e=>setTaxAmount(e.target.value)}/></label>
     {invoiceLines.map((line,index)=>{
      const product=poLines.find(row=>row.product_id===line.productId);
      return <div className="form-grid" key={line.productId}>
       <label>Product<input readOnly value={product?`${product.product_name} · ${product.product_id.slice(0,8)}`:line.productId}/></label>
       <label>Invoice quantity<input type="number" min="0.001" step="0.001" required value={line.quantityUnits} onChange={e=>changeLine(index,{quantityUnits:e.target.value})}/></label>
       <label>Unit cost<input type="number" min="0" step="0.0001" required value={line.unitCost} onChange={e=>changeLine(index,{unitCost:e.target.value})}/></label>
      </div>;
     })}
     {selectedPO&&!invoiceLines.length&&<p className="muted">No quantities have been received on this PO yet. Record the goods receipt before entering its invoice.</p>}
     <ActionGuard action="procurement.manage"><button className="primary-button" disabled={busy||!selectedPO||!invoiceLines.length||!invoiceNumber.trim()}>Record invoice</button></ActionGuard>
    </form>
   </ActionGuard>
   <div className="table-wrap"><table><thead><tr><th>Invoice</th><th>Supplier / PO</th><th>Date</th><th>Total</th><th>Match evidence / decision</th></tr></thead><tbody>
    {invoices.map(invoice=><tr key={invoice.id}><td>{invoice.invoice_number}<br/><small>{invoice.status}</small></td><td>{invoice.supplier_name}<br/><small>{invoice.po_number}</small></td><td>{invoice.invoice_date}</td><td>₹{Number(invoice.total_amount).toFixed(2)}</td><td>
     {(invoice.match_runs??[]).map(run=><div key={run.id} style={{padding:'6px 0'}}>
      <strong>{run.status}</strong> · Receipt qty overage {Number(run.quantityVariance).toFixed(3)} · Receipt value variance ₹{Number(run.valueVariance).toFixed(2)}<br/>
      <small>PO qty overage {Number(run.purchaseOrderQuantityVariance).toFixed(3)} · PO value variance ₹{Number(run.purchaseOrderValueVariance).toFixed(2)} · receipts {(run.goodsReceiptIds??[run.goodsReceiptId]).join(', ')}</small>
      {run.status==='VARIANCE'&&<ActionGuard action="procurement.approve"><div className="form-grid"><label>Decision reason<input minLength={3} value={varianceReason[run.id]??''} onChange={e=>setVarianceReason(rows=>({...rows,[run.id]:e.target.value}))}/></label><button className="secondary-button" disabled={busy} onClick={()=>void decide(run,'ACCEPTED')}>Accept variance</button><button className="secondary-button" disabled={busy} onClick={()=>void decide(run,'REJECTED')}>Reject invoice</button></div></ActionGuard>}
     </div>)}
     {(()=>{const receiptRows=receipts.filter(receipt=>receipt.purchase_order_id===invoice.purchase_order_id);const alreadyMatched=invoice.match_runs?.some(run=>run.status==='MATCHED');return receiptRows.length>0?<ActionGuard action="procurement.manage"><button className="secondary-button" disabled={busy||alreadyMatched} onClick={()=>void matchInvoice(invoice,receiptRows.map(receipt=>receipt.id))}>Match against all {receiptRows.length} posted receipt(s)</button></ActionGuard>:<small>Waiting for a posted goods receipt.</small>;})()}
    </td></tr>)}
    {!invoices.length&&<tr><td colSpan={5}>No supplier invoices recorded.</td></tr>}
   </tbody></table></div>
  </section>
  {(error||message)&&<div className={error?'notice':'notice success'} role={error?'alert':'status'}><span>{error||message}</span></div>}
 </div>;
}
