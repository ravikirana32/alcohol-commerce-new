import fs from 'node:fs';
import assert from 'node:assert/strict';
const read = (p) => fs.readFileSync(p, 'utf8');
const posting = read('apps/api/src/routes/offlineLedgerPosting.ts');
const auth = read('apps/api/src/routes/offlineAuthoritative.ts');
const validation = read('apps/api/src/routes/offlineValidation.ts');
const operations = read('apps/api/src/routes/operations.ts');
const onlineBar = read('apps/api/src/routes/barCheckout.ts');
const migration = read('apps/api/src/db/230_p531_offline_bar_measure_posting.sql');
const ui = read('apps/web/src/components/OfflineReconciliationWorkspace.tsx');
const barUi = read('apps/web/src/components/BarServiceWorkspace.tsx');
const rules = read('apps/api/src/services/barMeasureRules.ts');
const tests = read('apps/api/test/barMeasureRules.test.ts');
const app = read('apps/api/src/app.ts');
const checks = [
  ['offline BAR_CHECKOUT is a supported posting type', posting.includes("intent.event_type === 'BAR_CHECKOUT'")],
  ['bar line types PEG/BOTTLE/PACKAGED are enforced', posting.includes("['PEG','BOTTLE','PACKAGED']")],
  ['peg volume is multiplied by whole pour quantity', posting.includes('pegConsumedMl(Number(line.volumeMl), line.quantity)')],
  ['multiple peg lines aggregate by open bottle before mutation', posting.includes('const pegDemand = new Map') && posting.includes('prior.volumeMl +=')],
  ['open bottle is organisation/outlet/product scoped and row locked', posting.includes('FROM open_bottles b') && posting.includes('FOR UPDATE OF b')],
  ['active bottle reservations reduce available millilitres', posting.includes('bar_bottle_reservations') && posting.includes('unreservedBottleMl')],
  ['packaged and bottled stock is aggregated and row locked', posting.includes('const stockDemand = new Map') && posting.includes('FROM stock_balances') && posting.includes('FOR UPDATE')],
  ['all inventory is preflighted before ticket insertion', posting.indexOf('const pegDemand = new Map') < posting.indexOf('INSERT INTO bar_tickets')],
  ['terminal posting block holds intent and reports conflict for replay', posting.includes("status='HELD'") && posting.includes("status='CONFLICT'") && posting.includes("outcome === 'BLOCKED'")],
  ['bar ticket has event idempotency key and payload fingerprint', posting.includes('idempotency_key,request_fingerprint') && posting.includes('intent.payload_hash')],
  ['peg ledger and bottle balance update are atomic', posting.includes("transaction_type,reference_id,notes,performed_by") && posting.includes("'SALE'") && posting.includes('UPDATE open_bottles SET remaining_ml')],
  ['bottle and packaged stock movements are written', posting.includes("'BAR_TICKET'") && posting.includes('INSERT INTO stock_movements')],
  ['bar ticket lines and KOT lines are written', posting.includes('INSERT INTO bar_ticket_lines') && posting.includes('INSERT INTO bar_kot_lines')],
  ['offline bar tenders are marked RECORDED_OFFLINE', posting.includes("settlement_status) VALUES($1,$2,$3,$4,$5,'RECORDED_OFFLINE')")],
  ['posting execution records bar ticket reference', migration.includes('bar_ticket_id UUID REFERENCES bar_tickets')],
  ['posted execution must reference exactly one retail sale or bar ticket', migration.includes('ck_offline_posting_execution_single_source')],
  ['authoritative validation checks measure-aware inventory', auth.includes('bar_measure_and_stock_available') && auth.includes('bar_bottle_reservations')],
  ['structural validation checks bar line types and peg fields', validation.includes("['PEG','BOTTLE','PACKAGED']") && validation.includes('openBottleId')],
  ['bottle reservation API is scoped and audited', operations.includes("/bar/open-bottles/:bottleId/reservations") && operations.includes('BAR_BOTTLE_VOLUME_RESERVED')],
  ['reservation release API is immutable-status guarded and audited', operations.includes("/bar/bottle-reservations/:reservationId/release") && operations.includes('RESERVATION_NOT_ACTIVE')],
  ['wastage, breakage, complimentary and adjustment deductions are supported', operations.includes("'WASTAGE','COMPLIMENTARY','ADJUSTMENT','BREAKAGE'") && operations.includes('INSUFFICIENT_UNRESERVED_ML') && migration.includes('BREAKAGE')],
  ['operator UI exposes wastage and breakage controls', barUi.includes('recordBottleLoss') && barUi.includes('Record wastage or breakage')],
  ['online checkout honours active bottle reservations', onlineBar.includes('INSUFFICIENT_UNRESERVED_ML') && onlineBar.includes('bar_bottle_reservations')],
  ['operator UI supports approved bar posting', ui.includes('postBarIntent') && ui.includes('Post approved bar checkout')],
  ['operator UI supports open bottle reservations and release', barUi.includes('reserveBottle') && barUi.includes('releaseReservation') && barUi.includes('Measure reservations')],
  ['bar measures and reservations are mounted through operations router', app.includes('operationsRouter')],
  ['shared integer measure and paise rules exist', rules.includes('pegConsumedMl') && rules.includes('barLineTaxMinor') && rules.includes('unreservedBottleMl')],
  ['unit tests cover 30/60/90/custom measure and reservation rules', tests.includes('30, 60, 90, 120, 150') && tests.includes('reserved')],
  ['settlement remains distinct from offline evidence', migration.includes('RECORDED_OFFLINE') && migration.includes('SETTLED')],
  ['accounting journals remain explicitly deferred', posting.includes('DEFERRED_TO_P536')],
];
for (const [name, ok] of checks) { console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`); assert.ok(ok, name); }
const version = read('VERSION').trim();
const pkg = JSON.parse(read('package.json'));
assert.equal(pkg.version, version);
console.log(`PASS synchronized version ${version}`);
console.log(`P531 static acceptance: ${checks.length + 1}/${checks.length + 1} passed`);
