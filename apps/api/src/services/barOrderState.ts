export type BarOrderState='OPEN'|'SUBMITTED'|'PAID'|'CANCELLED';
const allowed:Record<BarOrderState,BarOrderState[]>={OPEN:['SUBMITTED','CANCELLED'],SUBMITTED:['PAID','CANCELLED'],PAID:[],CANCELLED:[]};
export function transitionBarOrder(from:BarOrderState,to:BarOrderState):BarOrderState { if(!allowed[from].includes(to)) throw new Error(`Invalid bar order transition ${from} -> ${to}`); return to; }
