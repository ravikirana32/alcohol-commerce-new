/** Pure integer/paise rules shared by bar checkout and offline posting. */
export function pegConsumedMl(volumeMl: number, quantity: number): number {
  if (!Number.isSafeInteger(volumeMl) || volumeMl <= 0) throw new Error('volumeMl must be a positive integer');
  if (!Number.isSafeInteger(quantity) || quantity <= 0) throw new Error('quantity must be a positive integer');
  const total = volumeMl * quantity;
  if (!Number.isSafeInteger(total)) throw new Error('peg volume exceeds safe integer range');
  return total;
}

export function unreservedBottleMl(remainingMl: number, reservedMl: number): number {
  if (!Number.isSafeInteger(remainingMl) || remainingMl < 0 || !Number.isSafeInteger(reservedMl) || reservedMl < 0) {
    throw new Error('Bottle and reservation volumes must be non-negative integers');
  }
  return Math.max(0, remainingMl - reservedMl);
}

export function barLineTaxMinor(unitPriceMinor: number, quantity: number, taxRate: number): number {
  if (!Number.isSafeInteger(unitPriceMinor) || unitPriceMinor < 0) throw new Error('unitPriceMinor must be non-negative integer paise');
  if (!Number.isSafeInteger(quantity) || quantity <= 0) throw new Error('quantity must be a positive integer');
  if (!Number.isFinite(taxRate) || taxRate < 0 || taxRate > 100) throw new Error('taxRate must be between 0 and 100');
  const baseMinor = unitPriceMinor * quantity;
  if (!Number.isSafeInteger(baseMinor)) throw new Error('Line amount exceeds safe integer range');
  return Math.round(baseMinor * taxRate / 100);
}
