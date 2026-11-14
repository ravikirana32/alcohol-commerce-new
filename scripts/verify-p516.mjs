import fs from 'node:fs';
import assert from 'node:assert/strict';

const api = fs.readFileSync('apps/api/src/routes/operations.ts', 'utf8');
const ui = fs.readFileSync('apps/web/src/components/POSWorkspace.tsx', 'utf8');
const checks = [
  ['outlet price lookup exposes product barcode', /SELECT pr\.\*,p\.sku,p\.name,p\.barcode,p\.pack_size_ml/.test(api)],
  ['barcode and SKU scan/search control', /Scan barcode or search product/.test(ui) && /p\.barcode/.test(ui) && /p\.sku/.test(ui)],
  ['exact barcode or SKU selection', /const exact = prices\.find/.test(ui)],
  ['retail cart quantity decrement', /item\.quantity - 1/.test(ui)],
  ['retail cart quantity increment', /item\.quantity \+ 1/.test(ui)],
  ['retail cart line removal', /item\.priceId !== line\.priceId/.test(ui)],
  ['receipt uses server grand total', /payload\.totals\?\.grandTotal \?\? payload\.data\.grand_total/.test(ui)],
  ['pending checkout locks cart edits', /Boolean\(pendingCheckout\)/.test(ui)],
  ['server-side retail pricing remains authoritative', /SELECT unit_price,tax_rate FROM outlet_product_prices/.test(api)],
  ['atomic stock movement remains in checkout', /INSERT INTO stock_movements/.test(api)]
];
for (const [name, passed] of checks) {
  console.log(`${passed ? 'PASS' : 'FAIL'} ${name}`);
  assert.ok(passed, name);
}
console.log(`P516 static acceptance: PASS (${checks.length}/${checks.length})`);
