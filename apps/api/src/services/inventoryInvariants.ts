export type StockMovement = { quantityDelta: number; reason: string };
export function assertStockMovement(m: StockMovement, currentQty: number, allowNegative = false): number {
 if (!Number.isSafeInteger(m.quantityDelta) || !Number.isSafeInteger(currentQty) || currentQty < 0) throw new Error('Stock quantities must be non-negative safe integers');
 if (!m.reason.trim()) throw new Error('Stock movement reason is required');
 const next = currentQty + m.quantityDelta;
 if (!Number.isSafeInteger(next) || (!allowNegative && next < 0)) throw new Error('Stock movement would create invalid or negative stock');
 return next;
}
