export type PurchaseState='DRAFT'|'SUBMITTED'|'APPROVED'|'PART_RECEIVED'|'RECEIVED'|'CANCELLED';
const edges:Record<PurchaseState,PurchaseState[]>={DRAFT:['SUBMITTED','CANCELLED'],SUBMITTED:['APPROVED','CANCELLED'],APPROVED:['PART_RECEIVED','RECEIVED','CANCELLED'],PART_RECEIVED:['RECEIVED'],RECEIVED:[],CANCELLED:[]};
export function transitionPurchaseOrder(from:PurchaseState,to:PurchaseState){if(!edges[from].includes(to))throw new Error('Invalid purchase order transition');return to;}
