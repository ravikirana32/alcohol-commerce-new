import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { ActionGuard } from '../ActionGuard';

type Mode = 'RETAIL' | 'BAR';
type Outlet = { id: string; name: string; outlet_code?: string; operating_mode?: string };
type TableSession = { id: string; table_label: string; covers: number };
type Price = {
  id: string; product_id: string; name: string; sku: string; barcode?: string | null; channel: string;
  volume_ml: number | null; unit_price: string | number; tax_rate: string | number;
};
type MenuAvailability = { product_id: string; measure_type: string | null; is_available: boolean | null };
type OpenBottle = { id: string; product_id: string; name: string; sku: string; remaining_ml: number; bottle_volume_ml: number };
type ModifierOption={id:string;name:string;priceDelta:number;status:string;ingredientName?:string|null;ingredientQuantity?:number};
type ModifierGroup={id:string;name:string;min_selections:number;max_selections:number;status:string;substitutes_product_id?:string|null;substitutes_product_name?:string|null;options:ModifierOption[]};
type PendingCheckout = { url: string; body: Record<string, unknown> };
type RetailCartLine = { priceId: string; productId: string; name: string; sku: string; quantity: number; unitPrice: number; taxRate: number };
type BarCartLine = { priceId:string; productId:string; name:string; sku:string; quantity:number; unitPrice:number; taxRate:number; lineType:'PEG'|'BOTTLE'|'PACKAGED'; volumeMl?:number; openBottleId?:string; modifiers:Array<{id:string;name:string;priceDelta:number}> };
type TenderLine = { id: string; method: string; amount: number; reference: string };
type ReceiptSnapshot = { receiptNumber: string; total: number; lines: Array<{ name: string; quantity: number; amount: number }>; tenders: TenderLine[]; createdAt: string };

const API = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8080';
const money = (value: number) => `₹${value.toFixed(2)}`;

export default function POSWorkspace({ mode, token }: { mode: Mode; token: string }) {
  const [outlets, setOutlets] = useState<Outlet[]>([]);
  const [outletId, setOutletId] = useState('');
  const [prices, setPrices] = useState<Price[]>([]);
  const [menuAvailability, setMenuAvailability] = useState<MenuAvailability[]>([]);
  const [modifierGroups,setModifierGroups]=useState<ModifierGroup[]>([]);
  const [selectedModifierIds,setSelectedModifierIds]=useState<string[]>([]);
  const [bottles, setBottles] = useState<OpenBottle[]>([]);
  const [tableSessions, setTableSessions] = useState<TableSession[]>([]);
  const [tableSessionId, setTableSessionId] = useState('');
  const [addToTab, setAddToTab] = useState(false);
  const [priceId, setPriceId] = useState('');
  const [productSearch, setProductSearch] = useState('');
  const [bottleId, setBottleId] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [tableLabel, setTableLabel] = useState('');
  const [tenders, setTenders] = useState<TenderLine[]>([{ id: 'tender-1', method: 'CASH', amount: 0, reference: '' }]);
  const [lastReceipt, setLastReceipt] = useState<ReceiptSnapshot | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [pendingCheckout, setPendingCheckout] = useState<PendingCheckout | null>(null);
  const [cart, setCart] = useState<RetailCartLine[]>([]);
  const [barCart, setBarCart] = useState<BarCartLine[]>([]);
  const [ageVerified, setAgeVerified] = useState(false);
  const [notIntoxicated, setNotIntoxicated] = useState(false);
  const [noRestrictedCustomer, setNoRestrictedCustomer] = useState(false);
  const [mealProvided, setMealProvided] = useState(false);

  const headers = useMemo(() => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }), [token]);

  const request = useCallback(async (url: string, init?: RequestInit) => {
    const response = await fetch(`${API}${url}`, { ...init, headers: { ...headers, ...((init?.headers ?? {}) as Record<string, string>) } });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(payload.error?.message ?? payload.error?.code ?? 'Request failed') as Error & { status?: number };
      error.status = response.status;
      throw error;
    }
    return payload;
  }, [headers]);

  useEffect(() => {
    request('/api/v1/outlets')
      .then((payload) => {
        const rows = payload.data ?? [];
        setOutlets(rows);
        if (rows[0]) setOutletId(rows[0].id);
      })
      .catch((err) => setError(err.message));
  }, [request]);

  const loadPrices = useCallback(async () => {
    if (!outletId) return;
    const channels = mode === 'RETAIL' ? ['RETAIL'] : ['BAR_PEG', 'BAR_BOTTLE', 'BAR_PACKAGED'];
    const all: Price[] = [];
    for (const channel of channels) {
      const payload = await request(`/api/v1/outlets/${outletId}/prices?channel=${channel}`);
      all.push(...(payload.data ?? []));
    }
    let availability: MenuAvailability[] = [];
    if (mode === 'BAR') {
      const menu = await request(`/api/v1/bar/menu?outletId=${outletId}`);
      availability = menu.data ?? [];
    }
    setMenuAvailability(availability);
    setPrices(all);
    const selectable = all.filter((price) => {
      if (mode !== 'BAR') return true;
      const measure = price.channel === 'BAR_PEG' ? 'PEG' : price.channel === 'BAR_BOTTLE' ? 'BOTTLE' : 'PACKAGED';
      return !availability.some((item) => item.product_id === price.product_id && item.measure_type === measure && item.is_available === false);
    });
    setPriceId(selectable[0]?.id ?? '');
  }, [mode, outletId, request]);

  useEffect(() => {
    setPrices([]);
    setMenuAvailability([]);
    setBottles([]);
    setTableSessions([]);
    setTableSessionId('');
    setPriceId('');
    if (!outletId) return;
    loadPrices().catch((err) => setError(err.message));
    if (mode === 'BAR') {
      request(`/api/v1/bar/open-bottles?outletId=${outletId}`)
        .then((payload) => setBottles(payload.data ?? []))
        .catch((err) => setError(err.message));
      request(`/api/v1/bar/table-sessions?outletId=${outletId}`)
        .then((payload) => setTableSessions(payload.data ?? []))
        .catch((err) => setError(err.message));
    }
  }, [loadPrices, mode, outletId, request]);

  const selectablePrices = prices.filter((price) => {
    if (mode !== 'BAR') return true;
    const measure = price.channel === 'BAR_PEG' ? 'PEG' : price.channel === 'BAR_BOTTLE' ? 'BOTTLE' : 'PACKAGED';
    return !menuAvailability.some((item) => item.product_id === price.product_id && item.measure_type === measure && item.is_available === false);
  });
  const selected = selectablePrices.find((p) => p.id === priceId);
  useEffect(()=>{
    setModifierGroups([]);setSelectedModifierIds([]);
    if(mode!=='BAR'||!selected?.product_id)return;
    request(`/api/v1/bar/modifiers?productId=${selected.product_id}`)
      .then(payload=>setModifierGroups((payload.data??[]).filter((group:ModifierGroup)=>group.status==='ACTIVE')))
      .catch(err=>setError(err instanceof Error?err.message:'Unable to load menu modifiers'));
  },[mode,selected?.product_id,selected?.channel,request]);
  const isPegSelected=mode==='BAR'&&selected?.channel==='BAR_PEG';
  const eligibleModifierGroups=modifierGroups.filter(group=>!(isPegSelected&&group.substitutes_product_id));
  const activeModifierOptions=eligibleModifierGroups.flatMap(group=>group.options.filter(option=>option.status==='ACTIVE'));
  const selectedModifiers=activeModifierOptions.filter(option=>selectedModifierIds.includes(option.id));
  const selectedModifierPrice=selectedModifiers.reduce((sum,option)=>sum+Number(option.priceDelta),0);
  const visiblePrices = selectablePrices.filter((p) => {
    const q = productSearch.trim().toLowerCase();
    return !q || p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q) || (p.barcode ?? '').toLowerCase().includes(q);
  });
  function scanOrSearch(value: string) {
    setProductSearch(value);
    const exact = selectablePrices.find((p) => (p.barcode ?? '').trim() === value.trim() || p.sku.toLowerCase() === value.trim().toLowerCase());
    if (exact) { setPriceId(exact.id); setProductSearch(''); }
  }
  const unitPrice = selected ? Number(selected.unit_price) : 0;
  const taxRate = selected ? Number(selected.tax_rate) : 0;
  const base = quantity * unitPrice;
  const tax = Math.round((base * taxRate / 100 + Number.EPSILON) * 100) / 100;
  const total = base + tax;
  const selectedBottle = bottles.find((b) => b.id === bottleId);
  const isPeg = mode === 'BAR' && selected?.channel === 'BAR_PEG';
  const retailCartTotal = cart.reduce((sum, line) => {
    const lineBase = line.quantity * line.unitPrice;
    const lineTax = Math.round((lineBase * line.taxRate / 100 + Number.EPSILON) * 100) / 100;
    return sum + lineBase + lineTax;
  }, 0);
  const barCartTotal = barCart.reduce((sum,line)=>{
    const base=line.quantity*(line.unitPrice+line.modifiers.reduce((total,modifier)=>total+modifier.priceDelta,0));
    return sum+base+Math.round((base*line.taxRate/100+Number.EPSILON)*100)/100;
  },0);
  const checkoutTotal = mode === 'RETAIL' ? Math.round((retailCartTotal + Number.EPSILON) * 100) / 100 : barCart.length ? Math.round((barCartTotal+Number.EPSILON)*100)/100 : total;

  const tenderTotal = Math.round((tenders.reduce((sum, tender) => sum + Number(tender.amount || 0), 0) + Number.EPSILON) * 100) / 100;
  const deferBarPayment = mode === 'BAR' && Boolean(tableSessionId) && addToTab;
  function addTender() {
    if (pendingCheckout) return;
    setTenders((rows) => [...rows, { id: crypto.randomUUID(), method: 'UPI', amount: 0, reference: '' }]);
  }
  function updateTender(id: string, patch: Partial<TenderLine>) {
    setTenders((rows) => rows.map((row) => row.id === id ? { ...row, ...patch } : row));
  }

  function addToCart() {
    if (!selected || mode !== 'RETAIL' || pendingCheckout) return;
    setCart((current) => {
      const existing = current.find((line) => line.priceId === selected.id);
      if (existing) return current.map((line) => line.priceId === selected.id ? { ...line, quantity: line.quantity + quantity } : line);
      return [...current, {
        priceId: selected.id, productId: selected.product_id, name: selected.name, sku: selected.sku,
        quantity, unitPrice, taxRate
      }];
    });
    setQuantity(1);
    setError('');
  }

  function addBarToCart() {
    if (!selected || mode !== 'BAR' || pendingCheckout) return;
    if (isPeg && (!selectedBottle || selectedBottle.product_id !== selected.product_id)) {
      setError('Select an open bottle of the selected product before adding a peg line.'); return;
    }
    for(const group of eligibleModifierGroups){
      const count=group.options.filter(option=>option.status==='ACTIVE'&&selectedModifierIds.includes(option.id)).length;
      if(count<Number(group.min_selections)||count>Number(group.max_selections)){
        setError(`Choose ${group.min_selections}-${group.max_selections} option(s) for ${group.name}.`);return;
      }
    }
    const lineType: BarCartLine['lineType'] = selected.channel === 'BAR_PEG' ? 'PEG' : selected.channel === 'BAR_BOTTLE' ? 'BOTTLE' : 'PACKAGED';
    setBarCart((rows) => [...rows, {
      priceId:selected.id,productId:selected.product_id,name:selected.name,sku:selected.sku,
      quantity,unitPrice,taxRate,lineType,
      modifiers:selectedModifiers.map(option=>({id:option.id,name:option.name,priceDelta:Number(option.priceDelta)})),
      ...(lineType==='PEG'?{volumeMl:Number(selected.volume_ml),openBottleId:bottleId}:{})
    }]);
    setQuantity(1);setBottleId('');setError('');
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError('');
    setMessage('');
    if (!outletId || (mode === 'RETAIL' ? cart.length === 0 : barCart.length === 0)) {
      setError(mode === 'RETAIL' ? 'Add at least one product to the cart.' : 'Select an outlet and a configured price.'); return;
    }
    if (!ageVerified || !notIntoxicated || !noRestrictedCustomer || (mode === 'BAR' && !mealProvided)) { setError('Complete all required excise compliance attestations before checkout.'); return; }
    if (!deferBarPayment && Math.abs(tenderTotal - checkoutTotal) > 0.001) { setError(`Tender total ${money(tenderTotal)} must equal checkout total ${money(checkoutTotal)}.`); return; }
    setBusy(true);
    try {
      let attempt = pendingCheckout;
      if (!attempt) {
        const id = crypto.randomUUID();
        if (mode === 'RETAIL') {
          attempt = {
            url: '/api/v1/retail/sales',
            body: {
              outletId, idempotencyKey: id, receiptNumber: `R-${id.slice(0, 8).toUpperCase()}`,
              lines: cart.map((line) => ({ productId: line.productId, quantity: line.quantity })),
              complianceAttestations: { ageVerified, notIntoxicated, noRestrictedCustomer, consumptionOnPremises: false },
              payments: tenders.filter((tender) => tender.amount > 0).map((tender) => ({ method: tender.method, amount: Number(tender.amount), ...(tender.reference.trim() ? { reference: tender.reference.trim() } : {}) }))
            }
          };
        } else {
          attempt = {
            url: '/api/v1/bar/checkout',
            body: {
              outletId, idempotencyKey: id, ticketNumber: `B-${id.slice(0, 8).toUpperCase()}`, tableLabel: tableLabel || undefined, ...(tableSessionId ? { tableSessionId } : {}),
              lines: barCart.map((line) => ({
                productId:line.productId,lineType:line.lineType,quantity:line.quantity,
                ...(line.modifiers.length?{modifierOptionIds:line.modifiers.map(modifier=>modifier.id)}:{}),
                ...(line.lineType==='PEG'?{volumeMl:line.volumeMl,openBottleId:line.openBottleId}:{})
              })),
              complianceAttestations: { ageVerified, notIntoxicated, noRestrictedCustomer, mealProvided, consumptionOnPremises: true },
              payments: deferBarPayment ? [] : tenders.filter((tender) => tender.amount > 0).map((tender) => ({ method: tender.method, amount: Number(tender.amount), ...(tender.reference.trim() ? { reference: tender.reference.trim() } : {}) }))
            }
          };
        }
        setPendingCheckout(attempt);
      }

      const payload = await request(attempt.url, { method: 'POST', body: JSON.stringify(attempt.body) });
      setPendingCheckout(null);
      const receiptLines = mode === 'RETAIL'
        ? (payload.lines ?? []).map((line: any, index: number) => ({ name: cart.find((item) => item.productId === line.productId)?.name ?? cart[index]?.name ?? 'Product', quantity: Number(line.quantity ?? line.quantity_units), amount: Number(line.lineTotal ?? line.line_total ?? 0) }))
        : barCart.map((line) => {
          const unitPrice=line.unitPrice+line.modifiers.reduce((sum,modifier)=>sum+modifier.priceDelta,0);
          const base=line.quantity*unitPrice;
          return {name:`${line.name} ${line.lineType==='PEG'?`${line.volumeMl} ml`:''}`,quantity:line.quantity,amount:base+Math.round((base*line.taxRate/100+Number.EPSILON)*100)/100};
        });
      setLastReceipt({
        receiptNumber: String(payload.data.receipt_number ?? payload.data.ticket_number ?? payload.data.id),
        total: Number(payload.totals?.grandTotal ?? payload.data.grand_total ?? checkoutTotal), lines: receiptLines, tenders: deferBarPayment ? [] : tenders.filter((tender) => tender.amount > 0), createdAt: new Date().toISOString()
      });
      if (mode === 'RETAIL') {
        setMessage(`Retail sale completed: ${payload.data.receipt_number ?? payload.data.id}. Total ${money(Number(payload.data.grand_total ?? checkoutTotal))}.`);
      } else {
        setMessage(deferBarPayment
          ? `Round added to ${tableSessions.find((session) => session.id === tableSessionId)?.table_label ?? 'the table tab'}: ${payload.data.ticket_number ?? payload.data.id}. Balance ${money(Number(payload.data.grand_total ?? checkoutTotal))}.`
          : `Bar ticket completed: ${payload.data.ticket_number ?? payload.data.id}. Total ${money(Number(payload.data.grand_total ?? checkoutTotal))}.`);
      }
      setQuantity(1);
      if (mode === 'RETAIL') setCart([]); else setBarCart([]);
      setTenders([{ id: crypto.randomUUID(), method: 'CASH', amount: 0, reference: '' }]);
      setAgeVerified(false); setNotIntoxicated(false); setNoRestrictedCustomer(false); setMealProvided(false);
      if (mode === 'BAR') {
        try {
          const [bottlesPayload, sessionsPayload] = await Promise.all([
            request(`/api/v1/bar/open-bottles?outletId=${outletId}`),
            request(`/api/v1/bar/table-sessions?outletId=${outletId}`)
          ]);
          setBottles(bottlesPayload.data ?? []);
          setTableSessions(sessionsPayload.data ?? []);
        } catch (refreshError) {
          setError(`Ticket was recorded, but bar data could not refresh: ${refreshError instanceof Error ? refreshError.message : 'refresh failed'}`);
        }
      }
    } catch (err) {
      const status = err && typeof err === 'object' && 'status' in err ? Number((err as {status?:number}).status) : 0;
      if (status >= 400 && status < 500) setPendingCheckout(null);
      setError(err instanceof Error ? err.message : 'Checkout failed');
    } finally {
      setBusy(false);
    }
  }

  return <section className="pos-workspace">
    <div className="pos-heading">
      <div><span className="eyebrow">LIVE API WORKSPACE · DEVELOPMENT/STAGING</span><h2>{mode === 'RETAIL' ? 'Retail checkout' : 'Bar checkout'}</h2>
        <p>{mode === 'RETAIL' ? 'Packaged product billing using active outlet prices and stock balances.' : 'Atomic ticket, payment and open-bottle deduction using active outlet prices.'}</p></div>
      <span className="tag">{mode === 'RETAIL' ? 'RETAIL' : 'BAR'}</span>
    </div>
    <form className="pos-form" onSubmit={submit}>
      <label>Outlet
        <select required disabled={busy || Boolean(pendingCheckout)} value={outletId} onChange={(e) => setOutletId(e.target.value)}>
          <option value="">Select outlet</option>
          {outlets.map((outlet) => <option key={outlet.id} value={outlet.id}>{outlet.name} {outlet.outlet_code ? `(${outlet.outlet_code})` : ''}</option>)}
        </select>
      </label>
      <label>Scan barcode or search product
        <input disabled={busy || Boolean(pendingCheckout)} value={productSearch} onChange={(e) => scanOrSearch(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); const exact = prices.find((p) => (p.barcode ?? '') === productSearch.trim() || p.sku.toLowerCase() === productSearch.trim().toLowerCase()); if (exact) { setPriceId(exact.id); setProductSearch(''); } } }} placeholder="Scan barcode or enter SKU / product name"/>
      </label>
      {mode === 'BAR' && <>
        <label>Open table session
          <select disabled={busy || Boolean(pendingCheckout)} value={tableSessionId} onChange={(e) => { setTableSessionId(e.target.value); const session=tableSessions.find((item)=>item.id===e.target.value); if(session)setTableLabel(session.table_label); }}>
            <option value="">Walk-in / no table session</option>
            {tableSessions.map((session)=><option key={session.id} value={session.id}>{session.table_label} · {session.covers} guests</option>)}
          </select>
        </label>
        {tableSessionId && <label><input type="checkbox" checked={addToTab} disabled={busy || Boolean(pendingCheckout)} onChange={(e)=>setAddToTab(e.target.checked)}/> Add this order as an unpaid tab round</label>}
        {!tableSessionId && <label>Table / service reference
          <input disabled={busy || Boolean(pendingCheckout)} value={tableLabel} onChange={(e) => setTableLabel(e.target.value)} placeholder="Optional table number"/>
        </label>}
      </>}
      <label>Product / service
        <select required disabled={busy || Boolean(pendingCheckout)} value={priceId} onChange={(e) => { setPriceId(e.target.value); setBottleId(''); }}>
          <option value="">Select configured price</option>
          {visiblePrices.map((price) => <option key={price.id} value={price.id}>
            {price.name} · {price.sku}{price.barcode ? ` · ${price.barcode}` : ''} · {price.channel === 'BAR_PEG' ? `${price.volume_ml} ml peg` : price.channel.replace('BAR_', '')} · {money(Number(price.unit_price))}
          </option>)}
        </select>
      </label>
      {isPeg && <label>Open bottle
        <select required={!barCart.some((line)=>line.lineType==='PEG')} disabled={busy || Boolean(pendingCheckout)} value={bottleId} onChange={(e) => setBottleId(e.target.value)}>
          <option value="">Select matching open bottle</option>
          {bottles.filter((b) => b.product_id === selected?.product_id && Number(b.remaining_ml) >= Number(selected?.volume_ml) * quantity)
            .map((b) => <option key={b.id} value={b.id}>{b.name} · {b.remaining_ml} ml remaining</option>)}
        </select>
      </label>}
      {mode==='BAR'&&eligibleModifierGroups.map(group=><fieldset key={group.id} className="tender-panel">
        <legend>{group.name} · {group.substitutes_product_name?`replace ${group.substitutes_product_name} · choose exactly one`:`choose ${group.min_selections}-${group.max_selections}`}</legend>
        {group.options.filter(option=>option.status==='ACTIVE').map(option=><label key={option.id}>
          <input type="checkbox" checked={selectedModifierIds.includes(option.id)} disabled={busy||Boolean(pendingCheckout)}
            onChange={event=>setSelectedModifierIds(ids=>event.target.checked?[...ids,option.id]:ids.filter(id=>id!==option.id))}/>
          {option.name}{Number(option.priceDelta)!==0?` · ${money(Number(option.priceDelta))}`:''}{option.ingredientName?` · uses ${option.ingredientName} ${option.ingredientQuantity??''}`:''}
        </label>)}
      </fieldset>)}
      {mode==='BAR'&&selectedModifierPrice!==0&&<small>Selected modifiers add {money(selectedModifierPrice)} per unit before tax.</small>}
      <label>Quantity
        <input disabled={busy || Boolean(pendingCheckout)} type="number" min="1" step="1" value={quantity} onChange={(e) => setQuantity(Math.max(1, Number(e.target.value) || 1))}/>
      </label>
      {deferBarPayment && <div className="tender-panel"><strong>Payment deferred</strong><small>This order will be sent to the table tab and KOT now. Take payment from the table service workspace before closing the session.</small></div>}
      <div className="tender-panel">
        <strong>Excise compliance checks</strong>
        <label><input type="checkbox" checked={ageVerified} disabled={busy || Boolean(pendingCheckout)} onChange={e=>setAgeVerified(e.target.checked)}/> I have checked acceptable proof of age and confirmed the customer is at least 21 years old.</label>
        <label><input type="checkbox" checked={notIntoxicated} disabled={busy || Boolean(pendingCheckout)} onChange={e=>setNotIntoxicated(e.target.checked)}/> Customer is not known or believed to be intoxicated.</label>
        <label><input type="checkbox" checked={noRestrictedCustomer} disabled={busy || Boolean(pendingCheckout)} onChange={e=>setNoRestrictedCustomer(e.target.checked)}/> Customer is not in another prohibited category under the applicable licence rules.</label>
        {mode === 'BAR' && <label><input type="checkbox" checked={mealProvided} disabled={busy || Boolean(pendingCheckout)} onChange={e=>setMealProvided(e.target.checked)}/> Meals or eatables are being supplied as required by this bar licence.</label>}
        <small>Attestations are recorded with the sale decision. The server separately checks the active legal rule pack, verified licence class, licence hours and dry-day orders.</small>
      </div>
      {!deferBarPayment && <div className="tender-panel">
        <strong>Payment split</strong>
        {tenders.map((tender) => <div className="tender-row" key={tender.id}>
          <select disabled={busy || Boolean(pendingCheckout)} value={tender.method} onChange={(e) => updateTender(tender.id, { method: e.target.value })}>
            <option value="CASH">Cash</option><option value="UPI">UPI</option><option value="CARD">Card</option><option value="WALLET">Wallet</option><option value="OTHER">Other</option>
          </select>
          <input disabled={busy || Boolean(pendingCheckout)} type="number" min="0" step="0.01" value={tender.amount || ''} placeholder="Amount" onChange={(e) => updateTender(tender.id, { amount: Math.max(0, Number(e.target.value) || 0) })}/>
          <input disabled={busy || Boolean(pendingCheckout)} value={tender.reference} placeholder="Reference (optional)" onChange={(e) => updateTender(tender.id, { reference: e.target.value })}/>
          <button type="button" disabled={busy || Boolean(pendingCheckout) || tenders.length === 1} onClick={() => setTenders((rows) => rows.filter((row) => row.id !== tender.id))}>Remove</button>
        </div>)}
        <button type="button" className="secondary-button" disabled={busy || Boolean(pendingCheckout)} onClick={addTender}>Add payment method</button>
        <small>Allocated {money(tenderTotal)} of {money(checkoutTotal)}</small>
      </div>}
      {mode === 'BAR' && <>
        <button className="secondary-button" type="button" disabled={busy||Boolean(pendingCheckout)||!selected||(isPeg&&!selectedBottle)} onClick={addBarToCart}>Add selected bar item to ticket</button>
        <div className="retail-cart">
          <strong>Ticket ({barCart.length} lines)</strong>
          {!barCart.length&&<small>No items added to this ticket.</small>}
          {barCart.map((line,index)=>{
            const base=line.quantity*(line.unitPrice+line.modifiers.reduce((sum,modifier)=>sum+modifier.priceDelta,0));
            const amount=base+Math.round((base*line.taxRate/100+Number.EPSILON)*100)/100;
            return <div className="retail-cart-line" key={`${line.priceId}-${index}`}>
              <span>{line.name} <small>{line.lineType} {line.volumeMl?`· ${line.volumeMl} ml`:''} · Qty {line.quantity} {line.openBottleId?'· open bottle selected':''}{line.modifiers.length?` · ${line.modifiers.map(modifier=>modifier.name).join(', ')}`:''}</small></span>
              <strong>{money(amount)}</strong>
              <button type="button" disabled={busy||Boolean(pendingCheckout)} onClick={()=>setBarCart(rows=>rows.filter((_,i)=>i!==index))}>Remove</button>
            </div>;
          })}
        </div>
      </>}
      {mode === 'RETAIL' && <>
        <button className="secondary-button" type="button" disabled={busy || Boolean(pendingCheckout) || !selected} onClick={addToCart}>Add selected product to cart</button>
        <div className="retail-cart">
          <strong>Cart ({cart.length} product lines)</strong>
          {!cart.length && <small>No products added yet.</small>}
          {cart.map((line) => {
            const lineBase = line.quantity * line.unitPrice;
            const lineTax = Math.round((lineBase * line.taxRate / 100 + Number.EPSILON) * 100) / 100;
            return <div className="retail-cart-line" key={line.priceId}>
              <span>{line.name} <small>{line.sku} · Qty {line.quantity}</small></span>
              <strong>{money(lineBase + lineTax)}</strong>
              <button type="button" disabled={busy || Boolean(pendingCheckout) || line.quantity <= 1} onClick={() => setCart((current) => current.map((item) => item.priceId === line.priceId ? { ...item, quantity: Math.max(1, item.quantity - 1) } : item))}>−</button>
              <button type="button" disabled={busy || Boolean(pendingCheckout)} onClick={() => setCart((current) => current.map((item) => item.priceId === line.priceId ? { ...item, quantity: item.quantity + 1 } : item))}>+</button>
              <button type="button" disabled={busy || Boolean(pendingCheckout)} onClick={() => setCart((current) => current.filter((item) => item.priceId !== line.priceId))}>Remove</button>
            </div>;
          })}
        </div>
      </>}
      <div className="pos-total"><span>Subtotal + tax</span><strong>{money(checkoutTotal)}</strong><small>Price and tax are resolved by the server from the active outlet price list.</small></div>
      <ActionGuard action={mode === 'RETAIL' ? 'retail.checkout' : 'bar.checkout'}><button className="primary-button" type="submit" disabled={busy || !outletId || (mode === 'RETAIL' ? cart.length === 0 : barCart.length === 0)}>{busy ? 'Processing…' : pendingCheckout ? 'Retry same checkout' : mode === 'RETAIL' ? 'Complete retail sale' : deferBarPayment ? 'Send round to table tab' : 'Complete bar checkout'}</button></ActionGuard>
    </form>
    {pendingCheckout && <div className="pos-alert" role="status">A checkout attempt is awaiting confirmation. Retry sends the exact same request and idempotency key; edit the cart only after the server confirms the result.</div>}
    {error && <div className="pos-alert error" role="alert">{error}</div>}
    {lastReceipt && <div className="receipt-preview">
      <div className="receipt-paper">
        <h3>AlcoSphere · {mode === 'RETAIL' ? 'Retail Receipt' : 'Bar Receipt'}</h3>
        <small>{lastReceipt.createdAt} · {lastReceipt.receiptNumber}</small>
        {lastReceipt.lines.map((line, index) => <div className="receipt-line" key={index}><span>{line.name} × {line.quantity}</span><strong>{money(line.amount)}</strong></div>)}
        <div className="receipt-total"><span>Total</span><strong>{money(lastReceipt.total)}</strong></div>
        {lastReceipt.tenders.map((tender) => <div className="receipt-line" key={tender.id}><span>{tender.method} {tender.reference}</span><strong>{money(tender.amount)}</strong></div>)}
        <p>Thank you. Please retain this receipt.</p>
      </div>
      <button type="button" className="secondary-button" onClick={() => window.print()}>Print receipt</button>
    </div>}
    {message && <div className="pos-alert success" role="status">{message}</div>}
    {!prices.length && outletId && <div className="pos-alert">No active prices are configured for this outlet and channel. An authorised manager must configure prices before checkout.</div>}
    <p className="pos-disclaimer">Development/staging workflow only. This screen does not override licence permissions or regulatory approvals.</p>
  </section>;
}
