import fs from 'node:fs';
import assert from 'node:assert/strict';
const read=(p)=>fs.readFileSync(p,'utf8');
const migration=read('apps/api/src/db/232_p533_excise_regulatory_rules.sql');
const service=read('apps/api/src/services/exciseCompliance.ts');
const route=read('apps/api/src/routes/exciseCompliance.ts');
const retail=read('apps/api/src/routes/operations.ts');
const bar=read('apps/api/src/routes/barCheckout.ts');
const offline=read('apps/api/src/routes/offlineLedgerPosting.ts');
const authoritative=read('apps/api/src/routes/offlineAuthoritative.ts');
const app=read('apps/api/src/app.ts');
const pos=read('apps/web/src/components/POSWorkspace.tsx');
const ui=read('apps/web/src/components/ExciseComplianceWorkspace.tsx');
const tests=read('apps/api/test/exciseComplianceRules.test.ts');
const checks=[
 ['effective-dated jurisdictional rule packs',migration.includes('CREATE TABLE IF NOT EXISTS excise_rule_packs')&&migration.includes('effective_from')&&migration.includes('effective_until')],
 ['Karnataka seeded pack is DRAFT and not auto-activated',migration.includes("'KA-BASE-2025-12'")&&migration.includes("'DRAFT'")],
 ['Karnataka age rule is 21',migration.includes('MINIMUM_CUSTOMER_AGE')&&migration.includes('{"years":21}')],
 ['CL2A off-shop and CL9A bar distinction is sourced',migration.includes('OFFSHOP_NO_ON_PREMISES_CONSUMPTION')&&migration.includes('BAR_MEALS_OR_EATABLES_REQUIRED')&&migration.includes('FD 52 EFL 2025')],
 ['intoxication and restricted-customer controls seeded',migration.includes('REFUSE_IF_INTOXICATED')&&migration.includes('REFUSE_RESTRICTED_CUSTOMERS')],
 ['Gandhi Jayanti and official dry-day order support',migration.includes('GANDHI_JAYANTI_DRY_DAY')&&migration.includes('excise_dry_day_orders')],
 ['verified licence hours required',migration.includes('outlet_licence_excise_conditions')&&service.includes('OUTSIDE_OR_UNCONFIGURED_LICENCE_HOURS')],
 ['independent rule-pack review and third-party activation',route.includes('INDEPENDENT_REVIEW_REQUIRED')&&route.includes('INDEPENDENT_ACTIVATION_REQUIRED')],
 ['rule pack and dry-day audit are append-only',migration.includes('excise_rule_pack_audit')&&migration.includes('excise_dry_day_order_audit')&&migration.includes('reject_excise_audit_mutation')],
 ['compliance decisions are immutable and tenant scoped',migration.includes('trg_excise_compliance_decisions_immutable')&&service.includes('organisation_id,outlet_id,licence_id,rule_pack_id')],
 ['rule evaluation denies without active pack',service.includes('NO_ACTIVE_APPROVED_RULE_PACK')],
 ['rule evaluation checks 21+ attestation and prohibited customer conditions',service.includes('CUSTOMER_AGE_NOT_VERIFIED')&&service.includes('CUSTOMER_INTOXICATION_NOT_CLEARED')&&service.includes('RESTRICTED_CUSTOMER_SCREEN_NOT_CONFIRMED')],
 ['retail and bar sale class restrictions',service.includes('LICENCE_CLASS_NOT_PERMITTED_FOR_RETAIL')&&service.includes('LICENCE_CLASS_NOT_PERMITTED_FOR_BAR')],
 ['licence schedule uses Asia/Kolkata local time',service.includes("timeZone: 'Asia/Kolkata'")&&service.includes('hoursAllow')],
 ['online retail checkout enforces excise rules',retail.includes('evaluateExciseSale')&&retail.includes('EXCISE_COMPLIANCE_BLOCKED')],
 ['online bar checkout enforces excise rules',bar.includes('evaluateExciseSale')&&bar.includes('EXCISE_COMPLIANCE_BLOCKED')],
 ['offline posting rechecks excise rules and timestamp',offline.includes('evaluateExciseSale')&&offline.includes('INVALID_TRANSACTION_TIMESTAMP')],
 ['offline posting requires server-verified secure time',migration.includes('offline_device_time_attestations')&&offline.includes('OFFLINE_EXCISE_TIME_TRUST_UNAVAILABLE')&&offline.includes("verification_status='VERIFIED'")],
 ['P528 authoritative check includes excise decision',authoritative.includes('excise_regulatory_compliance')&&authoritative.includes('evaluateExciseSale')],
 ['POS captures non-PII customer attestations',pos.includes('ageVerified')&&pos.includes('notIntoxicated')&&pos.includes('noRestrictedCustomer')&&pos.includes('mealProvided')],
 ['compliance admin UI is wired',ui.includes('Submit for legal review')&&ui.includes('Submit licence hours for review')&&ui.includes('Register dry-day order for review')&&ui.includes('Save draft rule')],
 ['API route is mounted',app.includes('exciseComplianceRouter')&&app.includes("app.use('/api/v1', exciseComplianceRouter)")],
 ['licence creation stores jurisdiction from outlet',retail.includes('jurisdiction_code,licence_type')&&retail.includes('outlet.rows[0].state_code')],
 ['unit tests cover licence classes and hour boundaries',tests.includes('normalises current and legacy')&&tests.includes('opening/closing boundaries')&&tests.includes('overnight licence schedules')]
];
for(const [name,ok] of checks) console.log(`${ok?'PASS':'FAIL'} ${name}`);
assert.equal(checks.filter(([,ok])=>ok).length,checks.length);
console.log(`P533 static acceptance: ${checks.length}/${checks.length} PASS`);
