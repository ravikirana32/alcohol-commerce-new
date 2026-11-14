export type TransferState='DRAFT'|'DISPATCHED'|'RECEIVED'|'CANCELLED';
const next:Record<TransferState,TransferState[]>={DRAFT:['DISPATCHED','CANCELLED'],DISPATCHED:['RECEIVED'],RECEIVED:[],CANCELLED:[]};
export function transferTransition(from:TransferState,to:TransferState):TransferState { if(!next[from].includes(to)) throw new Error('Invalid stock transfer transition'); return to; }
export function countVariance(expected:number,counted:number):number { if(!Number.isSafeInteger(expected)||!Number.isSafeInteger(counted)||expected<0||counted<0) throw new Error('Counts must be non-negative integers'); return counted-expected; }
