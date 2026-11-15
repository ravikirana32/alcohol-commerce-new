import { useCallback, useEffect, useState } from 'react';
import { ActionGuard } from '../ActionGuard';

const API=import.meta.env.VITE_API_BASE_URL??'http://localhost:8080';
type Outlet={id:string;name:string;outlet_code:string};
type Run={id:string;outlet_id:string;status:string;product_count:number;exception_count:number;completed_at:string};
type Exception={productId:string|null;type:string;severity:string;ledger:number;balance:number;variance:number|null};

export default function InventoryReconciliationWorkspace({token}:{token:string}){
 const [outlets,setOutlets]=useState<Outlet[]>([]);
 const [selectedIds,setSelectedIds]=useState<string[]>([]);
 const [runs,setRuns]=useState<Run[]>([]);
 const [latestExceptions,setLatestExceptions]=useState<Exception[]>([]);
 const [notes,setNotes]=useState('');
 const [error,setError]=useState('');
 const [message,setMessage]=useState('');
 const [busy,setBusy]=useState(false);
 const headers={Authorization:`Bearer ${token}`,'Content-Type':'application/json'};
 const request=useCallback(async(path:string,init:RequestInit={})=>{
  const response=await fetch(`${API}/api/v1${path}`,{...init,headers:{...headers,...((init.headers??{}) as Record<string,string>)}});
  const payload=await response.json().catch(()=>({}));
  if(!response.ok)throw new Error(payload.error?.message??payload.error?.code??'Request failed');
  return payload;
 },[token]);
 const load=useCallback(async()=>{
  try{
   const [outletResponse,runResponse]=await Promise.all([request('/outlets'),request('/inventory/reconciliation-runs')]);
   setOutlets(outletResponse.data??[]);setRuns(runResponse.data??[]);
  }catch(e){setError(e instanceof Error?e.message:'Unable to load inventory reconciliation');}
 },[request]);
 useEffect(()=>{void load();},[load]);
 function toggleOutlet(id:string){
  setSelectedIds(ids=>ids.includes(id)?ids.filter(item=>item!==id):[...ids,id]);
 }
 async function runReconciliation(){
  if(!selectedIds.length){setError('Select at least one outlet to reconcile.');return;}
  setBusy(true);setError('');setMessage('');setLatestExceptions([]);
  try{
   const result=await request('/inventory/reconciliation-runs',{
    method:'POST',body:JSON.stringify({outletIds:selectedIds,notes:notes||undefined})
   });
   const createdRuns:Run[]=result.data.runs?.map((row:{run:Run})=>row.run)??(result.data.run?[result.data.run]:[]);
   setLatestExceptions(result.data.runs?.flatMap((row:{exceptions:Exception[]})=>row.exceptions)??result.data.exceptions??[]);
   setRuns(current=>[...createdRuns,...current]);
   setMessage(`Completed inventory reconciliation for ${createdRuns.length} outlet${createdRuns.length===1?'':'s'}. No stock balance was automatically changed.`);
  }catch(e){setError(e instanceof Error?e.message:'Reconciliation failed');}
  finally{setBusy(false);}
 }
 return <section className="panel" style={{marginTop:16}}>
  <div className="panel-head"><div><h2>Cross-outlet stock reconciliation</h2><p>Compare each outlet's stock balance with its movement ledger. The run is read-only and records exceptions for investigation.</p></div><button className="secondary-button" onClick={()=>void load()}>Refresh</button></div>
  {error&&<div className="notice" role="alert"><span>{error}</span></div>}
  {message&&<div className="notice success" role="status"><span>{message}</span></div>}
  <div style={{display:'grid',gap:8,margin:'12px 0'}}>
   <strong>Select outlets</strong>
   {outlets.map(outlet=><label key={outlet.id}><input type="checkbox" checked={selectedIds.includes(outlet.id)} onChange={()=>toggleOutlet(outlet.id)}/> {outlet.name} · {outlet.outlet_code}</label>)}
  </div>
  <label>Run notes<textarea maxLength={1000} value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Optional reconciliation context"/></label>
  <ActionGuard action="inventory.read"><button className="primary-button" disabled={busy||!selectedIds.length} onClick={()=>void runReconciliation()}>{busy?'Reconciling…':'Run reconciliation'}</button></ActionGuard>
  {!!latestExceptions.length&&<div className="table-wrap" style={{marginTop:14}}><table><thead><tr><th>Product</th><th>Finding</th><th>Severity</th><th>Ledger</th><th>Balance</th><th>Variance</th></tr></thead><tbody>
   {latestExceptions.map((exception,index)=><tr key={`${exception.productId}-${exception.type}-${index}`}><td>{exception.productId??'—'}</td><td>{exception.type}</td><td>{exception.severity}</td><td>{exception.ledger??'—'}</td><td>{exception.balance??'—'}</td><td>{exception.variance??'—'}</td></tr>)}
  </tbody></table></div>}
  <h3>Recent runs</h3>
  <div className="table-wrap"><table><thead><tr><th>Outlet</th><th>Status</th><th>Products</th><th>Exceptions</th><th>Completed</th></tr></thead><tbody>
   {runs.slice(0,30).map(run=><tr key={run.id}><td>{outlets.find(outlet=>outlet.id===run.outlet_id)?.name??run.outlet_id}</td><td>{run.status}</td><td>{run.product_count}</td><td>{run.exception_count}</td><td>{new Date(run.completed_at).toLocaleString()}</td></tr>)}
   {!runs.length&&<tr><td colSpan={5}>No reconciliation runs yet.</td></tr>}
  </tbody></table></div>
 </section>;
}
