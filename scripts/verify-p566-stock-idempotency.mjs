import fs from 'node:fs';
import path from 'node:path';
const root = process.cwd();
const migration = fs.readFileSync(path.join(root,'apps/api/src/db/243_p566_stock_movement_idempotency.sql'),'utf8');
const service = fs.readFileSync(path.join(root,'apps/api/src/services/stockMovementIdempotency.ts'),'utf8');
const test = fs.readFileSync(path.join(root,'apps/api/src/services/stockMovementIdempotency.test.ts'),'utf8');
const checks = [
  ['adds nullable source-line idempotency key', /ADD COLUMN IF NOT EXISTS idempotency_key TEXT/.test(migration)],
  ['adds payload fingerprint', /ADD COLUMN IF NOT EXISTS request_fingerprint TEXT/.test(migration)],
  ['unique key is scoped by organisation and outlet', /organisation_id, outlet_id, idempotency_key/.test(migration)],
  ['partial index preserves legacy null keys', /WHERE idempotency_key IS NOT NULL/.test(migration)],
  ['helper uses conflict-safe insert', /ON CONFLICT[\s\S]*DO NOTHING/.test(service)],
  ['helper compares fingerprint on replay', /request_fingerprint[\s\S]*STOCK_MOVEMENT_IDEMPOTENCY_CONFLICT/.test(service)],
  ['helper does not mutate stock balances', !/UPDATE\s+stock_balances/i.test(service)],
  ['tests cover replay and payload conflict', /same key and same payload/.test(test) && /different payload/.test(test)],
  ['tests cover malformed keys and quantity', /malformed keys and non-positive quantities/.test(test)],
  ['migration and test command registered', JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8')).scripts['test:stock-idempotency:p566'] !== undefined],
];
let failed=0;
for (const [name,ok] of checks) { console.log(`${ok?'PASS':'FAIL'} ${name}`); if(!ok) failed++; }
console.log(`${checks.length-failed}/${checks.length} checks passed`);
if(failed) process.exit(1);
