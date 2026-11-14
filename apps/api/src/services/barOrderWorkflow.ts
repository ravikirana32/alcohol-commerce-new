export type BarState='OPEN'|'SENT'|'PREPARING'|'READY'|'SERVED'|'PAID'|'CANCELLED';
const next:Record<BarState,BarState[]>={OPEN:['SENT','CANCELLED'],SENT:['PREPARING','CANCELLED'],PREPARING:['READY','CANCELLED'],READY:['SERVED','CANCELLED'],SERVED:['PAID'],PAID:[],CANCELLED:[]};
export function transitionBarOrder(from:BarState,to:BarState){if(!next[from].includes(to))throw new Error(`Invalid bar transition ${from} -> ${to}`);return to;}
