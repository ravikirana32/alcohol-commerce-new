import fs from 'node:fs';
import assert from 'node:assert/strict';
const read = (p) => fs.readFileSync(new URL(p, import.meta.url), 'utf8');
const migration = read('../apps/api/src/db/231_p532_offline_exception_recovery.sql');
const route = read('../apps/api/src/routes/offlineRecovery.ts');
const posting = read('../apps/api/src/routes/offlineLedgerPosting.ts');
const app = read('../apps/api/src/app.ts');
const ui = read('../apps/web/src/components/OfflineRecoveryWorkspace.tsx');
const policy = read('../apps/api/src/services/offlineRecoveryPolicy.ts');
const tests = read('../apps/api/test/offlineRecoveryPolicy.test.ts');
const checks = [
  ['durable recovery cases', /CREATE TABLE IF NOT EXISTS offline_recovery_cases/.test(migration)],
  ['append-only recovery action log', /CREATE TABLE IF NOT EXISTS offline_recovery_actions/.test(migration)],
  ['tenant scope on case listing', /WHERE c\.organisation_id=\$1/.test(route)],
  ['triage endpoint', /\/triage/.test(route)],
  ['new-source-event retry rule', /requiresNewSourceEvent: true/.test(route) && /originalExecutionImmutable: true/.test(route)],
  ['held intent cancellation', /UPDATE offline_posting_intents SET status='CANCELLED'/.test(route)],
  ['maker-checker compensation decision', /canDecideCompensation\(c\.status, c\.requested_by, req\.auth!\.userId\)/.test(route)],
  ['compensation is non-mutating handoff', /compensationExecution: 'NOT_IMPLEMENTED'/.test(route) && /noFinancialMutation: true/.test(route)],
  ['automatic blocked case creation', /INSERT INTO offline_recovery_cases/.test(posting)],
  ['automatic blocked case action and audit', /INSERT INTO offline_recovery_actions/.test(posting) && /RECOVERY_CASE_OPENED/.test(posting)],
  ['route mounted', /offlineRecoveryRouter/.test(app)],
  ['operator recovery workspace', /OfflineRecoveryWorkspace/.test(ui)],
  ['retry policy test coverage', /requires a triaged blocked execution/.test(tests)],
  ['cancel policy test coverage', /cancels only blocked/.test(tests)],
  ['independent compensation test coverage', /enforces independent compensation decision/.test(tests)],
  ['explicit transition policy', /canRequestRetry/.test(policy) && /canCancelRecovery/.test(policy) && /canRequestCompensation/.test(policy)]
];
for (const [name, ok] of checks) console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`);
assert.equal(checks.filter(([,ok]) => ok).length, checks.length);
console.log(`P532 static acceptance: ${checks.length}/${checks.length} PASS`);
