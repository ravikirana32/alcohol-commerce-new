import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
const operations=fs.readFileSync(fileURLToPath(new URL('../src/routes/operations.ts',import.meta.url)),'utf8');
const bar=fs.readFileSync(fileURLToPath(new URL('../src/routes/barCheckout.ts',import.meta.url)),'utf8');
describe('checkout concurrency safeguards',()=>{
 it('locks retail stock balance rows before validating available units',()=>{expect(operations).toContain('FROM stock_balances WHERE organisation_id=$1 AND outlet_id=$2 AND product_id=$3 FOR UPDATE');});
 it('accounts for repeated retail product lines in the same sale',()=>{expect(operations).toContain('alreadyReserved=checked.filter');});
 it('locks and decrements stock for each bar line inside the transaction',()=>{expect(bar).toContain('FROM stock_balances\n            WHERE organisation_id=$1 AND outlet_id=$2 AND product_id=$3 FOR UPDATE');expect(bar).toContain('quantity_units=quantity_units-$1');});
 it('locks open bottle rows and rejects bottles that became unavailable during peg deduction',()=>{
  expect(bar).toContain('WHERE id=$1 AND outlet_id=$2 AND organisation_id=$3 AND product_id=$4\n            FOR UPDATE');
  expect(bar).toContain("if(bottle.rows[0].status!=='OPEN')");
 });
});
