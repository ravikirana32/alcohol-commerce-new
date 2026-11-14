import { useEffect, useMemo, useState } from 'react';
import { ActionGuard } from '../ActionGuard';

type Props={token:string};
const API=import.meta.env.VITE_API_BASE_URL??'http://localhost:8080';
const iso=(d:Date)=>d.toISOString().slice(0,10);
export default function ReportsWorkspace({token}:Props){
  const today=new Date(); const prior=new Date(); prior.setDate(today.getDate()-29);
  const [from,setFrom]=useState(iso(prior)); const [to,setTo]=useState(iso(today));
  const [overview,setOverview]=useState<any>(null); const [trend,setTrend]=useState<any[]>([]); const [products,setProducts]=useState<any[]>([]);
  const [busy,setBusy]=useState(false); const [error,setError]=useState('');
  const query=useMemo(()=>`from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,[from,to]);
  async function load(){setBusy(true);setError('');try{
    const headers={Authorization:`Bearer ${token}`};
    const [a,b,c]=await Promise.all([
      fetch(`${API}/api/v1/reports/overview?${query}`,{headers}),
      fetch(`${API}/api/v1/reports/sales-trend?${query}`,{headers}),
      fetch(`${API}/api/v1/reports/top-products?${query}`,{headers})
    ]);
    const payloads=await Promise.all([a.json(),b.json(),c.json()]);
    if(!a.ok||!b.ok||!c.ok)throw new Error(payloads.find((x,i)=>![a,b,c][i].ok)?.error?.message??'Unable to load reports');
    setOverview(payloads[0].data);setTrend(payloads[1].data??[]);setProducts(payloads[2].data??[]);
  }catch(e){setError(e instanceof Error?e.message:'Report loading failed');}finally{setBusy(false);}}
  useEffect(()=>{void load();},[]);
  function exportTrend(){const rows=[['Date','Retail transactions','Bar transactions','Retail gross','Bar gross','Total gross'],...trend.map(x=>[x.date,x.retailTransactions,x.barTransactions,x.retailGross,x.barGross,x.totalGross])];
    const csv=rows.map(r=>r.map(v=>`"${String(v??'').replaceAll('"','""')}"`).join(',')).join('\r\n');
    const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download=`sales-trend-${from}-${to}.csv`;a.click();URL.revokeObjectURL(url);}
  const money=(v:number)=>new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR',maximumFractionDigits:2}).format(v??0);
  return <section className="workspace-stack">
    <div className="panel"><div className="panel-head"><div><h2>Business intelligence</h2><p>Operational POS metrics; accounting and statutory reports retain their own approval requirements.</p></div><ActionGuard action="reports.export"><button className="primary-button" onClick={exportTrend} disabled={!trend.length}>Export sales CSV</button></ActionGuard></div>
      <div className="form-grid"><label>From<input type="date" value={from} onChange={e=>setFrom(e.target.value)}/></label><label>To<input type="date" value={to} onChange={e=>setTo(e.target.value)}/><button className="primary-button" onClick={load} disabled={busy||from>to}>{busy?'Loading…':'Apply filters'}</button></label></div>
      {error&&<p role="alert" className="error-text">{error}</p>}
    </div>
    {overview&&<div className="stats"><Stat label="Combined gross sales" value={money(overview.sales.combinedGross)} note="Completed retail + paid bar totals"/><Stat label="Transactions" value={String(overview.sales.combinedTransactions)} note="Completed / paid only"/><Stat label="Retail gross" value={money(overview.sales.retail.gross)} note={`${overview.sales.retail.transactions} transactions`}/><Stat label="Bar gross" value={money(overview.sales.bar.gross)} note={`${overview.sales.bar.transactions} tickets`}/></div>}
    <div className="two-col"><div className="panel"><div className="panel-head"><div><h2>Daily sales trend</h2><p>Gross totals by business date</p></div></div><div className="table-wrap"><table><thead><tr><th>Date</th><th>Retail</th><th>Bar</th><th>Total</th></tr></thead><tbody>{trend.map((x:any)=><tr key={x.date}><td>{x.date}</td><td>{money(x.retailGross)}</td><td>{money(x.barGross)}</td><td>{money(x.totalGross)}</td></tr>)}{!trend.length&&<tr><td colSpan={4}>No sales for selected period.</td></tr>}</tbody></table></div></div>
    <div className="panel"><div className="panel-head"><div><h2>Top products</h2><p>Ranked by gross sales</p></div></div><div className="table-wrap"><table><thead><tr><th>Product</th><th>Units</th><th>Gross</th></tr></thead><tbody>{products.slice(0,15).map((x:any)=><tr key={x.product_id}><td>{x.name}<small>{x.sku}</small></td><td>{x.units_sold}</td><td>{money(x.gross_sales)}</td></tr>)}{!products.length&&<tr><td colSpan={3}>No product sales for selected period.</td></tr>}</tbody></table></div></div></div>
    <p className="muted">Sales metrics use completed retail sales and paid bar tickets. Gross POS totals are not automatically equivalent to posted accounting revenue, tax returns or statutory excise reports.</p>
  </section>;
}
function Stat({label,value,note}:{label:string,value:string,note:string}){return <div className="stat-card"><span>{label}</span><strong>{value}</strong><small>{note}</small></div>}
