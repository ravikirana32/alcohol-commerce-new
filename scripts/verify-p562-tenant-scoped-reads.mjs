import fs from 'node:fs';
import path from 'node:path';
const root = process.cwd();
const source = fs.readFileSync(path.join(root, 'apps/api/src/routes/operations.ts'), 'utf8');
const checks = [
  ['shift preview retail payment query scopes payment and sale by organisation', /FROM sale_payments sp JOIN retail_sales s ON s\.id=sp\.sale_id[\s\S]{0,260}sp\.organisation_id=\$3 AND s\.organisation_id=\$3 AND s\.outlet_id=\$1[\s\S]{0,180}\[sh\.rows\[0\]\.outlet_id,sh\.rows\[0\]\.opened_at,orgId\(req\)\]/],
  ['shift preview bar payment query scopes payment and ticket by organisation', /FROM bar_payments bp JOIN bar_tickets t ON t\.id=bp\.ticket_id[\s\S]{0,260}bp\.organisation_id=\$3 AND t\.organisation_id=\$3 AND t\.outlet_id=\$1[\s\S]{0,180}\[sh\.rows\[0\]\.outlet_id,sh\.rows\[0\]\.opened_at,orgId\(req\)\]/],
  ['shift preview cash movement query scopes organisation outlet and shift', /FROM shift_cash_movements WHERE organisation_id=\$1 AND outlet_id=\$2 AND shift_id=\$3`,\[orgId\(req\),sh\.rows\[0\]\.outlet_id,req\.params\.shiftId\]/],
  ['shift preview refund query scopes both refund ledgers', /FROM retail_refunds WHERE organisation_id=\$3 AND outlet_id=\$1[\s\S]{0,220}FROM bar_refunds WHERE organisation_id=\$3 AND outlet_id=\$1[\s\S]{0,160}\[sh\.rows\[0\]\.outlet_id,sh\.rows\[0\]\.opened_at,orgId\(req\)\]/],
  ['shift close retail payment query scopes payment and sale by organisation', /FROM sale_payments sp JOIN retail_sales s ON s\.id=sp\.sale_id[\s\S]{0,260}sp\.organisation_id=\$3 AND s\.organisation_id=\$3 AND s\.outlet_id=\$1[\s\S]{0,180}\[sh\.rows\[0\]\.outlet_id,sh\.rows\[0\]\.opened_at,orgId\(req\)\]/g],
  ['shift close bar payment query scopes payment and ticket by organisation', /FROM bar_payments bp JOIN bar_tickets t ON t\.id=bp\.ticket_id[\s\S]{0,260}bp\.organisation_id=\$3 AND t\.organisation_id=\$3 AND t\.outlet_id=\$1[\s\S]{0,180}\[sh\.rows\[0\]\.outlet_id,sh\.rows\[0\]\.opened_at,orgId\(req\)\]/g],
  ['shift close cash movement query scopes organisation outlet and shift', /FROM shift_cash_movements WHERE organisation_id=\$1 AND outlet_id=\$2 AND shift_id=\$3`,\[orgId\(req\),sh\.rows\[0\]\.outlet_id,req\.params\.shiftId\]/g],
  ['shift close refund query scopes both refund ledgers', /FROM retail_refunds WHERE organisation_id=\$3 AND outlet_id=\$1[\s\S]{0,220}FROM bar_refunds WHERE organisation_id=\$3 AND outlet_id=\$1[\s\S]{0,160}\[sh\.rows\[0\]\.outlet_id,sh\.rows\[0\]\.opened_at,orgId\(req\)\]/g],
];
let failed = 0;
for (const [label, pattern] of checks) {
  const count = pattern.global ? [...source.matchAll(pattern)].length : (pattern.test(source) ? 1 : 0);
  const expected = pattern.global ? 2 : 1;
  const ok = count === expected;
  console.log(`${ok ? 'PASS' : 'FAIL'} ${label} (${count}/${expected})`);
  if (!ok) failed++;
}
console.log(`${checks.length-failed}/${checks.length} P562 source assertions passed`);
if (failed) process.exit(1);
