import { FormEvent, useCallback, useEffect, useState } from 'react';
import { ActionGuard } from '../ActionGuard';
type Outlet={id:string;name:string};
type Product={id:string;name:string;sku:string;pack_size_ml?:number};
type Balance={product_id:string;name:string;sku:string;quantity_units:string|number;outlet_id:string};
type Batch=Record<string,any>;
const API=import.meta.env.VITE_API_BASE_URL??'http://localhost:8080';
export default function InventoryWorkspace({token}:{token:string}){
 const [outlets,setOutlets]=useState<Outlet[]>([]),[products,setProducts]=useState<Product[]>([]),[balances,setBalances]=useState<Balance[]>([]);
 const [outletId,setOutletId]=useState(''),[productId,setProductId]=useState(''),[quantity,setQuantity]=useState(1),[delta,setDelta]=useState(0),[reason,setReason]=useState(''),[reference,setReference]=useState('');
 const [batchNumber,setBatchNumber]=useState(''),[expiryDate,setExpiryDate]=useState(''),[unitCost,setUnitCost]=useState(''),[batches,setBatches]=useState<Batch[]>([]);
 const [mode,setMode]=useState<'RECEIPT'|'ADJUSTMENT'|'WASTAGE'>('RECEIPT'),[wastageCategory,setWastageCategory]=useState<'SPOILAGE'|'BREAKAGE'|'EXPIRED'|'OTHER'>('SPOILAGE'),[busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState('');
 const request=useCallback(async(url:string,init?:RequestInit)=>{
  const r=await fetch(`${API}${url}`,{...init,headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`,...((init?.headers??{}) as Record<string,string>)}});
  const p=await r.json().catch(()=>({}));if(!r.ok)throw new Error(p.error?.message??p.error?.code??'Request failed');return p;
 },[token]);
 const loadBalances=useCallback(async(id:string)=>{if(!id)return;const p=await request(`/api/v1/inventory/balances?outletId=${id}`);setBalances(p.data??[]);},[request]);
 const loadBatches=useCallback(async(id:string)=>{if(!id)return;const p=await request(`/api/v1/inventory/batches?outletId=${id}&expiringWithinDays=365`);setBatches(p.data??[]);},[request]);
 useEffect(()=>{
  Promise.all([request('/api/v1/outlets'),request('/api/v1/catalogue/products')]).then(([o,p])=>{
   const os=o.data??[],ps=p.data??[];setOutlets(os);setProducts(ps);if(os[0])setOutletId(os[0].id);if(ps[0])setProductId(ps[0].id);
  }).catch(e=>setError(e.message));
 },[request]);
 useEffect(()=>{if(outletId)Promise.all([loadBalances(outletId),loadBatches(outletId)]).catch(e=>setError(e.message));},[outletId,loadBalances,loadBatches]);
 async function submit(e:FormEvent){
  e.preventDefault();setBusy(true);setError('');setMessage('');
  try{
   const body=mode==='RECEIPT'?{outletId,productId,quantity,reference,notes:reason,unitCost:unitCost===''?undefined:Number(unitCost),...(batchNumber?{batchNumber,expiryDate:expiryDate||undefined}:{})}:mode==='WASTAGE'?{outletId,productId,quantity,category:wastageCategory,reason}:{outletId,productId,delta,reason};
   const path=mode==='RECEIPT'&&batchNumber?'/api/v1/inventory/batches':mode==='RECEIPT'?'/api/v1/inventory/receipts':mode==='WASTAGE'?'/api/v1/inventory/wastage':'/api/v1/inventory/adjustments';
   const p=await request(path,{method:'POST',headers:{'Idempotency-Key':crypto.randomUUID().replaceAll('-','')},body:JSON.stringify(body)});
   setMessage(mode==='RECEIPT'?`Stock receipt posted. Movement ${p.data.id}.`:mode==='WASTAGE'?`Wastage recorded. New balance ${p.balance}.`:`Stock adjustment posted. New balance ${p.balance}.`);
   setQuantity(1);setDelta(0);setReason('');setReference('');setBatchNumber('');setExpiryDate('');setUnitCost('');await Promise.all([loadBalances(outletId),loadBatches(outletId)]);
  }catch(e){setError(e instanceof Error?e.message:'Inventory operation failed');}finally{setBusy(false);}
 }
 return <section className="inventory-workspace">
  <div className="pos-heading"><div><span className="eyebrow">INVENTORY CONTROL · DEVELOPMENT/STAGING</span><h2>Inventory and stock receipts</h2><p>Review outlet stock balances and post auditable receipts or authorised adjustments.</p></div><span className="tag">INVENTORY</span></div>
  <label className="shift-outlet">Outlet<select value={outletId} onChange={e=>setOutletId(e.target.value)}><option value="">Select outlet</option>{outlets.map(o=><option key={o.id} value={o.id}>{o.name}</option>)}</select></label>
  <div className="inventory-layout">
   <div className="sales-list"><h3>Stock balances</h3>{balances.map(b=><div className="stock-row" key={b.product_id}><span><strong>{b.name}</strong><small>{b.sku}</small></span><b>{Number(b.quantity_units).toFixed(3)}</b></div>)}{!balances.length&&<p className="muted">No stock balances for this outlet.</p>}</div>
   <form className="shift-form" onSubmit={submit}>
    <h3>Post inventory movement</h3>
    <label>Movement type<select value={mode} onChange={e=>setMode(e.target.value as 'RECEIPT'|'ADJUSTMENT'|'WASTAGE')}><option value="RECEIPT">Receive stock</option><option value="ADJUSTMENT">Stock adjustment</option><option value="WASTAGE">Record wastage</option></select></label>
    <label>Product<select value={productId} onChange={e=>setProductId(e.target.value)}>{products.map(p=><option key={p.id} value={p.id}>{p.name} · {p.sku}</option>)}</select></label>
    {mode==='RECEIPT'?<>
     <label>Received quantity<input type="number" min="0.001" step="0.001" required value={quantity} onChange={e=>setQuantity(Number(e.target.value)||0)}/></label>
     <label>Supplier/reference<input value={reference} onChange={e=>setReference(e.target.value)}/></label>
     <label>Batch / lot number (optional)<input value={batchNumber} onChange={e=>setBatchNumber(e.target.value)}/></label>
     {batchNumber&&<label>Expiry date<input type="date" value={expiryDate} onChange={e=>setExpiryDate(e.target.value)}/></label>}
     <label>Unit cost (optional)<input type="number" min="0" step="0.0001" value={unitCost} onChange={e=>setUnitCost(e.target.value)}/></label>
    </>:mode==='WASTAGE'?<>
     <label>Wasted quantity<input type="number" min="0.001" step="0.001" required value={quantity} onChange={e=>setQuantity(Number(e.target.value)||0)}/></label>
     <label>Wastage category<select value={wastageCategory} onChange={e=>setWastageCategory(e.target.value as typeof wastageCategory)}><option value="SPOILAGE">Spillage / spoilage</option><option value="BREAKAGE">Breakage</option><option value="EXPIRED">Expired stock</option><option value="OTHER">Other</option></select></label>
    </>:<label>Quantity delta (+/-)<input type="number" step="0.001" required value={delta} onChange={e=>setDelta(Number(e.target.value)||0)}/></label>}
    <label>Reason / notes<input required minLength={3} value={reason} onChange={e=>setReason(e.target.value)}/></label>
    <ActionGuard action={mode==='RECEIPT'?'inventory.receive':'inventory.adjust'}><button className="primary-button" disabled={busy||!outletId||!productId||reason.trim().length<3||(mode==='ADJUSTMENT'?delta===0:quantity<=0)}>{busy?'Posting…':mode==='RECEIPT'?'Receive stock':mode==='WASTAGE'?'Record wastage':'Post adjustment'}</button></ActionGuard>
   </form>
  </div>
  {error&&<div className="pos-alert error" role="alert">{error}</div>}{message&&<div className="pos-alert success" role="status">{message}</div>}
  <div className="sales-list" style={{marginTop:16}}><h3>Batch and expiry control</h3>{batches.map(batch=><div className="stock-row" key={batch.id}><span><strong>{batch.name} · {batch.batch_number}</strong><small>{batch.sku} · {batch.expiry_date?`Expiry ${new Date(batch.expiry_date).toLocaleDateString()}`:'No expiry recorded'}</small></span><b>{Number(batch.remaining_units).toFixed(3)}</b></div>)}{!batches.length&&<p className="muted">No batches to display.</p>}</div>
  <WarehouseControls token={token} outlets={outlets} products={products}/>
  <p className="pos-disclaimer">Tracked lots are issued by earliest expiry first; expired lots are blocked from sale. Unknown-age legacy stock is retained as a no-expiry batch until its lot evidence is recorded.</p>
 </section>;
}


type WarehouseOutlet={id:string;name:string};
type WarehouseProduct={id:string;name:string;sku:string};
function WarehouseControls({token,outlets,products}:{token:string;outlets:WarehouseOutlet[];products:WarehouseProduct[]}){
 const [source,setSource]=useState(''),[destination,setDestination]=useState(''),[product,setProduct]=useState(''),[qty,setQty]=useState(1),[number,setNumber]=useState(''),[transfers,setTransfers]=useState<any[]>([]),[counts,setCounts]=useState<any[]>([]),[selectedCount,setSelectedCount]=useState<any|null>(null),[countValues,setCountValues]=useState<Record<string,string>>({}),[countReason,setCountReason]=useState('Physical stock count'),[notice,setNotice]=useState(''),[problem,setProblem]=useState(''),[working,setWorking]=useState(false);
 const api=async(path:string,body?:unknown,method='GET')=>{const r=await fetch(`${API}${path}`,{method,headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},...(body?{body:JSON.stringify(body)}:{})});const p=await r.json().catch(()=>({}));if(!r.ok)throw new Error(p.error?.message??p.error?.code??'Warehouse request failed');return p;};
 const refresh=async()=>{const [t,c]=await Promise.all([api('/api/v1/inventory/transfers'),api('/api/v1/inventory/stocktakes')]);setTransfers(t.data??[]);setCounts(c.data??[]);};
 useEffect(()=>{if(outlets.length){setSource(outlets[0].id);setDestination(outlets[1]?.id??'');}if(products.length)setProduct(products[0].id);},[outlets,products]);
 useEffect(()=>{refresh().catch(e=>setProblem(e.message));},[token]);
 const run=async(fn:()=>Promise<void>)=>{setWorking(true);setProblem('');setNotice('');try{await fn();}catch(e){setProblem(e instanceof Error?e.message:'Operation failed');}finally{setWorking(false);}};
 const createTransfer=()=>run(async()=>{const transferNumber=number.trim()||`TR-${Date.now()}`;await api('/api/v1/inventory/transfers',{transferNumber,sourceOutletId:source,destinationOutletId:destination,lines:[{productId:product,quantity:qty}]},'POST');setNumber('');setNotice(`Transfer ${transferNumber} created.`);await refresh();});
 const dispatch= (id:string)=>run(async()=>{await api(`/api/v1/inventory/transfers/${id}/dispatch`,{},'POST');setNotice('Transfer dispatched; source stock has been deducted.');await refresh();});
 const receive=(id:string)=>run(async()=>{const detail=await api(`/api/v1/inventory/transfers/${id}`);const lines=(detail.data.lines??[]).map((l:any)=>({productId:l.product_id,receivedQuantity:Number(l.dispatched_units??0),varianceReason:'Received in full'}));await api(`/api/v1/inventory/transfers/${id}/receive`,{lines},'POST');setNotice('Transfer received in full; destination stock has been credited.');await refresh();});
 const loadStocktake=async(id:string)=>{const result=await api(`/api/v1/inventory/stocktakes/${id}`);setSelectedCount(result.data);setCountValues(Object.fromEntries([...(result.data.lines??[]).map((line:any)=>[line.product_id,String(line.counted_units)]),...(result.data.batchLines??[]).map((line:any)=>[line.batch_id,String(line.counted_units)])]));};
 const stocktake=()=>run(async()=>{if(!source)throw new Error('Select an outlet first');const created=await api('/api/v1/inventory/stocktakes',{outletId:source,notes:'Physical stocktake created from inventory workspace'},'POST');setNotice('Count snapshot created. Enter quantities and submit the count for approval.');await refresh();await loadStocktake(created.data.id);});
 const saveCount=(line:any,batch:boolean)=>run(async()=>{const countedUnits=Number(countValues[batch?line.batch_id:line.product_id]);if(!Number.isFinite(countedUnits)||countedUnits<0)throw new Error('Enter a non-negative stock quantity');const path=batch?`/api/v1/inventory/stocktakes/${selectedCount.id}/batches/${line.batch_id}`:`/api/v1/inventory/stocktakes/${selectedCount.id}/lines/${line.product_id}`;await api(path,{countedUnits},'PUT');await loadStocktake(selectedCount.id);setNotice('Count saved.');});
 const submitCount=()=>run(async()=>{await api(`/api/v1/inventory/stocktakes/${selectedCount.id}/submit`,{},'POST');await loadStocktake(selectedCount.id);setNotice('Count submitted; stock remains unchanged until approval.');await refresh();});
 const approveCount=()=>run(async()=>{if(countReason.trim().length<3)throw new Error('Enter a reason for the stocktake adjustment');await api(`/api/v1/inventory/stocktakes/${selectedCount.id}/approve`,{reason:countReason},'POST');await loadStocktake(selectedCount.id);setNotice('Count approved; stock balances, ledger, and batch quantities were reconciled.');await refresh();});
 const batchedProducts=new Set((selectedCount?.batchLines??[]).map((line:any)=>line.product_id));
 return <div className="inventory-warehouse-controls">
  <div className="pos-heading"><div><span className="eyebrow">P518 · WAREHOUSE OPERATIONS</span><h3>Transfers and physical stocktakes</h3><p>Move stock between outlets with separate dispatch and receipt confirmation.</p></div></div>
  <div className="inventory-layout">
   <form className="shift-form" onSubmit={e=>{e.preventDefault();createTransfer();}}><h3>Create stock transfer</h3>
    <label>Transfer number<input value={number} onChange={e=>setNumber(e.target.value)} placeholder="Auto-generated if blank"/></label>
    <label>Source outlet<select required value={source} onChange={e=>setSource(e.target.value)}>{outlets.map(o=><option key={o.id} value={o.id}>{o.name}</option>)}</select></label>
    <label>Destination outlet<select required value={destination} onChange={e=>setDestination(e.target.value)}><option value="">Select destination</option>{outlets.filter(o=>o.id!==source).map(o=><option key={o.id} value={o.id}>{o.name}</option>)}</select></label>
    <label>Product<select required value={product} onChange={e=>setProduct(e.target.value)}>{products.map(p=><option key={p.id} value={p.id}>{p.name} · {p.sku}</option>)}</select></label>
    <label>Quantity<input type="number" min="0.001" step="0.001" required value={qty} onChange={e=>setQty(Number(e.target.value)||0)}/></label>
    <ActionGuard action="inventory.receive"><button className="primary-button" disabled={working||!source||!destination||!product||source===destination||qty<=0}>Create transfer</button></ActionGuard>
   </form>
   <div className="sales-list"><h3>Recent transfers</h3>{transfers.map(t=><div className="stock-row" key={t.id}><span><strong>{t.transfer_number}</strong><small>{t.source_outlet_name} → {t.destination_outlet_name}</small><small>{t.status}</small></span><span>{t.status==='DRAFT'?<button disabled={working} onClick={()=>dispatch(t.id)}>Dispatch</button>:t.status==='DISPATCHED'?<button disabled={working} onClick={()=>receive(t.id)}>Confirm full receipt</button>:null}</span></div>)}{!transfers.length&&<p className="muted">No transfers yet.</p>}</div>
  </div>
  <div className="sales-list"><div className="pos-heading"><div><h3>Physical stocktakes</h3><p>Enter actual quantities, submit, and approve to post differences to inventory.</p></div><button disabled={working||!source} onClick={stocktake}>Start stocktake</button></div>{counts.map(c=><div className="stock-row" key={c.id}><span><strong>{c.id.slice(0,8)}</strong><small>{c.status} · {new Date(c.created_at).toLocaleString()}</small></span><button disabled={working} onClick={()=>run(()=>loadStocktake(c.id))}>Open count</button></div>)}{!counts.length&&<p className="muted">No stocktakes yet.</p>}</div>
  {selectedCount&&<div className="sales-list" style={{marginTop:12}}><div className="pos-heading"><div><h3>Count {selectedCount.id.slice(0,8)} · {selectedCount.status}</h3><p>Variance is not posted until approval.</p></div><button className="secondary-button" onClick={()=>setSelectedCount(null)}>Close</button></div>
   {(selectedCount.lines??[]).filter((line:any)=>!batchedProducts.has(line.product_id)).map((line:any)=><div className="stock-row" key={line.product_id}><span><strong>{line.name} · {line.sku}</strong><small>Expected {Number(line.expected_units).toFixed(3)}</small></span><input aria-label={`Count ${line.name}`} type="number" min="0" step="0.001" disabled={selectedCount.status!=='COUNTING'||working} value={countValues[line.product_id]??''} onChange={e=>setCountValues({...countValues,[line.product_id]:e.target.value})}/><button disabled={selectedCount.status!=='COUNTING'||working} onClick={()=>saveCount(line,false)}>Save</button></div>)}
   {(selectedCount.batchLines??[]).map((line:any)=><div className="stock-row" key={line.batch_id}><span><strong>{products.find(p=>p.id===line.product_id)?.name??line.product_id.slice(0,8)} · {line.batch_number}</strong><small>Expected {Number(line.expected_units).toFixed(3)} · {line.expiry_date??'No expiry recorded'}</small></span><input aria-label={`Count ${line.batch_number}`} type="number" min="0" step="0.001" disabled={selectedCount.status!=='COUNTING'||working} value={countValues[line.batch_id]??''} onChange={e=>setCountValues({...countValues,[line.batch_id]:e.target.value})}/><button disabled={selectedCount.status!=='COUNTING'||working} onClick={()=>saveCount(line,true)}>Save</button></div>)}
   {selectedCount.status==='COUNTING'&&<button disabled={working} onClick={submitCount}>Submit count</button>}
   {selectedCount.status==='SUBMITTED'&&<div style={{display:'flex',gap:8,marginTop:12}}><input aria-label="Stocktake approval reason" value={countReason} onChange={e=>setCountReason(e.target.value)}/><button disabled={working} onClick={approveCount}>Approve and post variance</button></div>}
  </div>}
  {problem&&<div className="pos-alert error" role="alert">{problem}</div>}{notice&&<div className="pos-alert success" role="status">{notice}</div>}
 </div>;
}
