// P469: Batch expiry sale block
export const isBatchSellable = (expiryDate:string,today:string,blocked:boolean) => { const e=Date.parse(expiryDate+'T00:00:00Z'),t=Date.parse(today+'T00:00:00Z'); if(!Number.isFinite(e)||!Number.isFinite(t)) throw new Error('Invalid date'); return !blocked && e>=t; };
