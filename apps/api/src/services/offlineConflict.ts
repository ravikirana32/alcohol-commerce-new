export type ConflictKind='DUPLICATE_OPERATION'|'STALE_STOCK'|'PRICE_CHANGED'|'LICENCE_CHANGED'|'UNKNOWN';
export function classifyOfflineConflict(kind:ConflictKind):'AUTO_REJECT'|'MANUAL_REVIEW' { return kind==='DUPLICATE_OPERATION'?'AUTO_REJECT':'MANUAL_REVIEW'; }
