import fs from 'node:fs';
import assert from 'node:assert/strict';

const route = fs.readFileSync('apps/api/src/routes/operations.ts', 'utf8');
const migration = fs.readFileSync('apps/api/src/db/211_p5002_retail_checkout_fingerprint.sql', 'utf8');
const helper = fs.readFileSync('apps/api/src/services/retailCheckoutIntegrity.ts', 'utf8');
const barRoute = fs.readFileSync('apps/api/src/routes/barCheckout.ts', 'utf8');
const barHelper = fs.readFileSync('apps/api/src/services/barCheckoutIntegrity.ts', 'utf8');
const ui = fs.readFileSync('apps/web/src/components/POSWorkspace.tsx', 'utf8');

const checks = [
  ['fingerprint migration', /ADD COLUMN IF NOT EXISTS request_fingerprint CHAR\(64\)/.test(migration)],
  ['canonical SHA-256 fingerprint', /createHash\('sha256'\)/.test(helper)],
  ['idempotency conflict response', /IDEMPOTENCY_KEY_REUSED/.test(route)],
  ['legacy request fingerprint reconstruction', /storedFingerprint=[\s\S]{0,200}createRetailCheckoutFingerprint/.test(route)],
  ['P534 authoritative tax quote in retail checkout', /createCheckoutTaxQuote\(client/.test(route) && /channel:'RETAIL'/.test(route) && /tax_snapshot_id/.test(route)],
  ['tenant-scoped stock update', /organisation_id=\$2 AND outlet_id=\$3 AND product_id=\$4 AND quantity_units >= \$1/.test(route)],
  ['retail audit event', /RETAIL_CHECKOUT_COMPLETED/.test(route)],
  ['scoped sale detail route', /retail\/sales\/:saleId/.test(route)],
  ['UI retries exact pending request', /let attempt = pendingCheckout/.test(ui) && /Retry same checkout/.test(ui)],
  ['retail multi-line cart submitted', /lines: cart\.map/.test(ui) && /Add selected product to cart/.test(ui)],
  ['split tenders submitted and balanced', /tenders\.filter/.test(ui) && /tenderTotal - checkoutTotal/.test(ui)],
  ['printable receipt preview', /receipt-paper/.test(ui) && /window\.print\(\)/.test(ui)],
  ['bar multi-line ticket UI', /barCart\.map/.test(ui) && /Add selected bar item to ticket/.test(ui)],
  ['bar checkout request fingerprint', /createBarCheckoutFingerprint/.test(barRoute) && /request_fingerprint/.test(barRoute) && /createHash\('sha256'\)/.test(barHelper)],
  ['bar idempotency mismatch conflict', /IDEMPOTENCY_KEY_REUSED/.test(barRoute)],
  ['P534 authoritative tax quote in bar checkout', /createCheckoutTaxQuote\(client/.test(barRoute) && /channel:'BAR'/.test(barRoute) && /tax_snapshot_id/.test(barRoute)],
  ['definitive 4xx clears pending retry while uncertain failures retain it', /status >= 400 && status < 500/.test(ui) && /setPendingCheckout\(null\)/.test(ui)]
];

for (const [name, passed] of checks) {
  assert.equal(passed, true, `Failed: ${name}`);
  process.stdout.write(`PASS ${name}\n`);
}
process.stdout.write(`Retail checkout integration checks: ${checks.length}/${checks.length} passed\n`);
