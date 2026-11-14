import { describe, expect, it } from 'vitest';
import { assertStockMovement } from '../src/services/inventoryInvariants.js';
import { pegRemainder } from '../src/services/pegMeasures.js';
import { expectedCash } from '../src/services/cashReconciliation.js';
import { assertLedgerBalanced } from '../src/services/ledgerBalance.js';
import { validateTenders } from '../src/services/paymentTenders.js';
describe('P301-P350 pure business invariants',()=>{
 it('prevents negative stock',()=>expect(()=>assertStockMovement({quantityDelta:-3,reason:'sale'},2)).toThrow());
 it('deducts exact peg volume',()=>expect(pegRemainder(750,60,2)).toBe(630));
 it('computes cash close',()=>expect(expectedCash(1000,500,100,50,20)).toBe(1430));
 it('requires balanced ledger',()=>expect(()=>assertLedgerBalanced([100],[90])).toThrow());
 it('requires tender sum to equal total',()=>expect(()=>validateTenders(100,[{method:'CASH',amountMinor:90}])).toThrow());
});
