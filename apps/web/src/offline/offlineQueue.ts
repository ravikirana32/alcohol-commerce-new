export type OfflineOperation={operationId:string;createdAt:string;outletId:string;kind:'RETAIL_SALE'|'BAR_CHECKOUT';payload:unknown;status:'PENDING'|'SYNCED'|'CONFLICT'};
export function validateOfflineOperation(x:OfflineOperation):void { if(!x.operationId||!x.outletId||!Number.isFinite(Date.parse(x.createdAt))) throw new Error('Offline operation identity and timestamp are required'); if(!['RETAIL_SALE','BAR_CHECKOUT'].includes(x.kind)) throw new Error('Unsupported offline operation'); }
export const OFFLINE_DB_VERSION=1;
