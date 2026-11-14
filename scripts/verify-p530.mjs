import fs from 'node:fs';
import assert from 'node:assert/strict';
const root = new URL('../', import.meta.url).pathname;
const route = fs.readFileSync(`${root}apps/api/src/routes/offlineLedgerPosting.ts`, 'utf8');
const migration = fs.readFileSync(`${root}apps/api/src/db/229_p530_offline_transactional_posting.sql`, 'utf8');
const app = fs.readFileSync(`${root}apps/api/src/app.ts`, 'utf8');
const ui = fs.readFileSync(`${root}apps/web/src/components/OfflineReconciliationWorkspace.tsx`, 'utf8');
const checks = [
  ['posting route mounted', app.includes('offlineLedgerPostingRouter')],
  ['authentication and org scope', route.includes('authenticate, requireOrgScope')],
  ['posting permission', route.includes("requirePermission('offline:ledger-post')")],
  ['independent approval required', route.includes("intent.approval_outcome !== 'APPROVE'")],
  ['structural and authoritative validation required', route.includes("intent.validation_outcome !== 'PASS'") && route.includes("intent.authoritative_outcome !== 'PASS'")],
  ['intent row lock', route.includes('FOR UPDATE OF i,e')],
  ['stock row lock', route.includes('FOR UPDATE') && route.includes('FROM stock_balances')],
  ['guarded stock decrement', route.includes('quantity_units >= $1')],
  ['stock movement written', route.includes("'SALE'") && route.includes("'RETAIL_SALE'")],
  ['sale payment evidence written', route.includes("'RECORDED_OFFLINE'")],
  ['retail posting remains supported', route.includes("p.channel='RETAIL'") && route.includes('retail_sale_lines')],
  ['P531 bar checkout path is enabled', route.includes("intent.event_type === 'BAR_CHECKOUT'") && route.includes('BAR_MEASURE_AND_STOCK_POSTED')],
  ['execution idempotency constraint', migration.includes('posting_intent_id UUID NOT NULL UNIQUE') && migration.includes('event_row_id UUID NOT NULL UNIQUE')],
  ['intent state posted', route.includes("status='POSTED'")],
  ['event state posted', route.includes("offline_sync_events SET status='POSTED'")],
  ['atomic transaction', route.includes("BEGIN") && route.includes("COMMIT") && route.includes("ROLLBACK")],
  ['audit event', route.includes("'LEDGER_POSTED'") && migration.includes('LEDGER_POSTED')],
  ['journal explicitly deferred', route.includes('JOURNAL_DEFERRED_TO_P536')],
  ['execution read endpoint', route.includes("'/offline/posting-executions'")],
  ['operator UI exposes retail posting action', ui.includes('postRetailIntent') && ui.includes('Post approved retail sale')],
  ['operator UI confirms irreversible action', ui.includes('window.confirm')],
  ['operator UI exposes bar posting action', ui.includes('postBarIntent') && ui.includes('Post approved bar checkout')],
];
for (const [name, ok] of checks) { console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`); assert.ok(ok, name); }
console.log(`P530 static acceptance: ${checks.length}/${checks.length} passed`);
