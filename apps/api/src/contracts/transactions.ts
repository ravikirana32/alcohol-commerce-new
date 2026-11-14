export type Tender = { method: 'CASH' | 'UPI' | 'CARD' | 'OTHER'; amountMinor: number; reference?: string };
export function assertTenderBalance(totalMinor: number, tenders: Tender[]): void {
 if (!Number.isSafeInteger(totalMinor) || totalMinor < 0 || !tenders.length) throw new Error('A valid total and at least one tender are required');
 if (tenders.some(t => !Number.isSafeInteger(t.amountMinor) || t.amountMinor < 0)) throw new Error('Tender amounts must be non-negative integer minor units');
 if (tenders.reduce((s,t)=>s+t.amountMinor,0) !== totalMinor) throw new Error('Tender total does not match transaction total');
}
