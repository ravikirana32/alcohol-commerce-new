export type PriceChannel = 'RETAIL' | 'BAR_BOTTLE' | 'BAR_PACKAGED' | 'BAR_PEG';
export type CataloguePriceInput = { productId: string; channel: PriceChannel; unitPriceMinor: number; taxRateBps: number; volumeMl?: number };
export function validateCataloguePrice(input: CataloguePriceInput): void {
 if (!input.productId.trim()) throw new Error('productId is required');
 if (!Number.isSafeInteger(input.unitPriceMinor) || input.unitPriceMinor < 0) throw new Error('unitPriceMinor must be a non-negative integer');
 if (!Number.isSafeInteger(input.taxRateBps) || input.taxRateBps < 0 || input.taxRateBps > 10000) throw new Error('taxRateBps must be between 0 and 10000');
 if (input.channel === 'BAR_PEG' && (!Number.isSafeInteger(input.volumeMl) || (input.volumeMl ?? 0) <= 0)) throw new Error('BAR_PEG requires positive integer volumeMl');
 if (input.channel !== 'BAR_PEG' && input.volumeMl !== undefined) throw new Error('volumeMl is only valid for BAR_PEG');
}
