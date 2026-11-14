import { useCallback, useEffect, useState } from 'react';
import { ActionGuard } from '../ActionGuard';

const API = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8080';
type Row = Record<string, any>;
export default function TradePortalWorkspace({ token }: { token: string }) {
  const [relationships, setRelationships] = useState<Row[]>([]);
  const [orders, setOrders] = useState<Row[]>([]);
  const [supplierId, setSupplierId] = useState('');
  const [catalogue, setCatalogue] = useState<Row[]>([]);
  const [quantities, setQuantities] = useState<Record<string, string>>({});
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
  const request = useCallback(async (path: string, init: RequestInit = {}) => {
    const response = await fetch(`${API}/api/v1${path}`, { ...init, headers: { ...headers, ...(init.headers || {}) } });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body?.error?.message || body?.error?.code || `Request failed (${response.status})`);
    return body.data;
  }, [token]);
  const refresh = useCallback(async () => {
    try {
      const [r, o] = await Promise.all([request('/trade/relationships'), request('/trade/orders')]);
      setRelationships(r || []); setOrders(o || []);
    } catch (e) { setMessage(e instanceof Error ? e.message : 'Unable to load trade portal'); }
  }, [request]);
  useEffect(() => { void refresh(); }, [refresh]);
  const loadCatalogue = async () => {
    setBusy(true); setMessage('');
    try { setCatalogue(await request(`/trade/catalogue?supplierOrganisationId=${encodeURIComponent(supplierId)}`) || []); }
    catch (e) { setMessage(e instanceof Error ? e.message : 'Catalogue unavailable'); }
    finally { setBusy(false); }
  };
  const submitOrder = async () => {
    const lines = catalogue.filter(x => Number(quantities[x.catalogue_item_id] || 0) > 0)
      .map(x => ({ catalogueItemId: x.catalogue_item_id, quantity: Number(quantities[x.catalogue_item_id]) }));
    if (!supplierId || !lines.length) { setMessage('Select a supplier and enter at least one order quantity.'); return; }
    setBusy(true); setMessage('');
    try {
      await request('/trade/orders', { method: 'POST', body: JSON.stringify({ supplierOrganisationId: supplierId, orderNumber: `PO-${Date.now()}`, lines }) });
      setQuantities({}); setMessage('Purchase order submitted. Supplier acceptance is still required.'); await refresh();
    } catch (e) { setMessage(e instanceof Error ? e.message : 'Order submission failed'); }
    finally { setBusy(false); }
  };
  const transition = async (order: Row, status: string) => {
    setBusy(true); setMessage('');
    try { await request(`/trade/orders/${order.id}/status`, { method: 'POST', body: JSON.stringify({ status }) }); await refresh(); }
    catch (e) { setMessage(e instanceof Error ? e.message : 'Status update failed'); }
    finally { setBusy(false); }
  };
  return <div className="workspace-stack">
    <div className="notice"><strong>Trade portal</strong><span>Supplier relationships, approved trade catalogue, purchase orders and fulfilment status. Regulatory and tax checks remain authoritative at the outlet transaction boundary.</span></div>
    {message && <div className="notice" role="status">{message}</div>}
    <section className="panel"><div className="panel-head"><div><h2>Supplier relationships</h2><p>Only approved suppliers with active relationships expose catalogue items.</p></div><span className="tag">{relationships.length} relationships</span></div>
      <div className="table-wrap"><table><thead><tr><th>Supplier</th><th>Buyer</th><th>Status</th><th>Requested</th></tr></thead><tbody>{relationships.map(x => <tr key={x.id}><td>{x.supplier_name}</td><td>{x.buyer_name}</td><td>{x.status}</td><td>{x.requested_at ? new Date(x.requested_at).toLocaleDateString() : '—'}</td></tr>)}{!relationships.length && <tr><td colSpan={4}>No trade relationships found.</td></tr>}</tbody></table></div>
    </section>
    <section className="panel"><div className="panel-head"><div><h2>Create purchase order</h2><p>Choose an active supplier relationship and order quantities meeting supplier minimums.</p></div></div>
      <div className="form-row"><label>Supplier organisation ID<input value={supplierId} onChange={e => setSupplierId(e.target.value)} placeholder="Supplier UUID"/></label><button className="secondary-button" disabled={busy || !supplierId} onClick={() => void loadCatalogue()}>Load catalogue</button></div>
      {catalogue.length > 0 && <><div className="table-wrap"><table><thead><tr><th>Product</th><th>SKU</th><th>Trade price</th><th>MOQ</th><th>Quantity</th></tr></thead><tbody>{catalogue.map(x => <tr key={x.catalogue_item_id}><td>{x.name}</td><td>{x.sku}</td><td>{Number(x.trade_price).toFixed(2)}</td><td>{x.minimum_order_quantity}</td><td><input aria-label={`Quantity ${x.name}`} type="number" min={x.minimum_order_quantity} step="1" value={quantities[x.catalogue_item_id] || ''} onChange={e => setQuantities(v => ({ ...v, [x.catalogue_item_id]: e.target.value }))}/></td></tr>)}</tbody></table></div><ActionGuard action="trade.manage"><button className="primary-button" disabled={busy} onClick={() => void submitOrder()}>Submit purchase order</button></ActionGuard></>}
    </section>
    <section className="panel"><div className="panel-head"><div><h2>Purchase orders & fulfilment</h2><p>Supplier-side status actions follow the permitted order lifecycle.</p></div><span className="tag">{orders.length} orders</span></div>
      <div className="table-wrap"><table><thead><tr><th>Order</th><th>Supplier</th><th>Buyer</th><th>Status</th><th>Subtotal</th><th>Action</th></tr></thead><tbody>{orders.map(x => <tr key={x.id}><td>{x.order_number}</td><td>{x.supplier_name}</td><td>{x.buyer_name}</td><td>{x.status}</td><td>{Number(x.subtotal).toFixed(2)}</td><td>{x.status === 'SUBMITTED' ? <><ActionGuard action="trade.manage"><button className="text-button" disabled={busy} onClick={() => void transition(x, 'ACCEPTED')}>Accept</button></ActionGuard> <ActionGuard action="trade.manage"><button className="text-button" disabled={busy} onClick={() => void transition(x, 'REJECTED')}>Reject</button></ActionGuard></> : x.status === 'ACCEPTED' ? <ActionGuard action="trade.manage"><button className="text-button" disabled={busy} onClick={() => void transition(x, 'PROCESSING')}>Process</button></ActionGuard> : x.status === 'PROCESSING' ? <ActionGuard action="trade.manage"><button className="text-button" disabled={busy} onClick={() => void transition(x, 'DISPATCHED')}>Dispatch</button></ActionGuard> : x.status === 'DISPATCHED' ? <ActionGuard action="trade.manage"><button className="text-button" disabled={busy} onClick={() => void transition(x, 'DELIVERED')}>Mark delivered</button></ActionGuard> : '—'}</td></tr>)}{!orders.length && <tr><td colSpan={6}>No purchase orders found.</td></tr>}</tbody></table></div>
    </section>
  </div>;
}
