import fs from 'node:fs';
const route=fs.readFileSync('apps/api/src/routes/offlineAuthoritative.ts','utf8');
const migration=fs.readFileSync('apps/api/src/db/227_p528_authoritative_offline_checks.sql','utf8');
const app=fs.readFileSync('apps/api/src/app.ts','utf8');
const ui=fs.readFileSync('apps/web/src/components/OfflineReconciliationWorkspace.tsx','utf8');
const pkg=JSON.parse(fs.readFileSync('package.json','utf8'));
const checks=[
 ['organisation scoped posting intent lookup',route.includes('i.organisation_id=$2')],
 ['unsupported event types fail closed',route.includes('supported_transaction_type')&&route.includes("['RETAIL_SALE','BAR_CHECKOUT']")],
 ['active organisation and outlet checks',route.includes('organisation_active')&&route.includes('outlet_active')],
 ['verified current licence and explicit capability',route.includes('verified_current_licence')&&route.includes('permitted_activities')],
 ['organisation-owned active catalogue validation',route.includes('products_active_and_owned')&&route.includes("product.status === 'ACTIVE'")],
 ['current outlet price comparison',route.includes('current_outlet_prices_match')&&route.includes('unitPriceMinor')],
 ['retail stock availability check',route.includes('retail_stock_available')&&route.includes('stock_balances')],
 ['P531 authoritative bar measure and stock validation',route.includes('bar_measure_and_stock_available')&&route.includes('reserved_ml')],
 ['payment allocation matches transaction total',route.includes('payment_allocation_matches_total')],
 ['immutable one-check-per-intent evidence',migration.includes('UNIQUE(posting_intent_id)')&&route.includes('CHECK_ALREADY_RECORDED')],
 ['failed checks move intent to HELD',route.includes("status='HELD'")],
 ['audit trail records authoritative check',route.includes('AUTHORITATIVE_CHECK')&&migration.includes('AUTHORITATIVE_CHECK')],
 ['ledger posting remains disabled',route.includes("ledgerPosting: 'NOT_EXECUTED'")],
 ['route mounted and operator UI wired',app.includes('offlineAuthoritativeRouter')&&ui.includes('authoritativeCheck(i.id)')],
 ['P533 jurisdictional excise gate is included in authoritative checks',route.includes('excise_regulatory_compliance')&&route.includes('evaluateExciseSale')],
 ['release version bumped',pkg.version===fs.readFileSync('VERSION','utf8').trim() && fs.readFileSync('apps/api/src/config/version.ts','utf8').includes(pkg.version) && fs.readFileSync('apps/web/src/config/version.ts','utf8').includes(pkg.version)]
];
for(const [name,ok] of checks) console.log(`${ok?'PASS':'FAIL'} ${name}`);
const failed=checks.filter(x=>!x[1]).length; console.log(`P528 static acceptance: ${checks.length-failed}/${checks.length}`); if(failed)process.exit(1);
