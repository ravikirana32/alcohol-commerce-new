export type BarRecipeIngredient = { id: string; productId: string; quantity: number };

export function scaleRecipeQuantity(quantity: number, yieldQuantity: number, soldQuantity: number): number {
  if (![quantity, yieldQuantity, soldQuantity].every(Number.isFinite)
    || quantity <= 0 || yieldQuantity <= 0 || soldQuantity <= 0) {
    throw new Error('Recipe quantities must be positive finite numbers');
  }
  const scaled = Math.round((quantity * soldQuantity / yieldQuantity) * 1000) / 1000;
  if (!Number.isFinite(scaled) || scaled <= 0) throw new Error('Scaled recipe quantity is invalid');
  return scaled;
}
