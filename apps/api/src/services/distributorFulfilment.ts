export type Fulfilment='PLACED'|'ACCEPTED'|'PICKING'|'DISPATCHED'|'DELIVERED'|'REJECTED';
const next:Record<Fulfilment,Fulfilment[]>={PLACED:['ACCEPTED','REJECTED'],ACCEPTED:['PICKING'],PICKING:['DISPATCHED'],DISPATCHED:['DELIVERED'],DELIVERED:[],REJECTED:[]};
export function fulfilmentTransition(a:Fulfilment,b:Fulfilment):Fulfilment { if(!next[a].includes(b)) throw new Error('Invalid fulfilment transition'); return b; }
export function assertFulfilmentQty(q:number):void { if(!Number.isSafeInteger(q)||q<=0) throw new Error('Fulfilment quantity must be positive integer'); }
