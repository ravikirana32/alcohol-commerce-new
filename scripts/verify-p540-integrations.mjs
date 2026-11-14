import fs from 'node:fs';
import assert from 'node:assert/strict';
const read=(p)=>fs.readFileSync(p,'utf8');
const sql=read('apps/api/src/db/241_p540_enterprise_integrations.sql');
const route=read('apps/api/src/routes/enterpriseIntegrations.ts');
const app=read('apps/api/src/app.ts');
const checks=[
 ['tenant scoped integration registry',/organisation_id UUID NOT NULL REFERENCES organisations\(id\)/.test(sql)],
 ['provider allowlist',/provider_code IN \('ACCOUNTING_EXPORT','ERP','DELIVERY','CRM','DATA_WAREHOUSE','CUSTOM'\)/.test(sql)],
 ['HTTPS endpoint constraint',/endpoint_url IS NULL OR endpoint_url ~ '\^https:\/\/'/.test(sql)],
 ['credential reference only',/credential_env_ref/.test(sql)&&!/secret_value|api_secret|password TEXT/i.test(sql)],
 ['durable idempotent outbox',/UNIQUE \(organisation_id,integration_id,idempotency_key\)/.test(sql)],
 ['delivery attempts append table',/CREATE TABLE IF NOT EXISTS integration_delivery_attempts/.test(sql)],
 ['authenticated organisation scope',/use\(authenticate, requireOrgScope\)/.test(route)],
 ['permission gated reads and writes',/requirePermission\('integration:read'\)/.test(route)&&/requirePermission\('integration:manage'\)/.test(route)],
 ['HTTPS validated in API',/startsWith\('https:\/\/'\)/.test(route)],
 ['revocation cancels queued events',/status='CANCELLED'/.test(route)],
 ['dispatch remains explicitly disabled',/deliveryEnabled:false/.test(route)&&/deliveryEnabled:false/.test(route)],
 ['router registered',/enterpriseIntegrationsRouter/.test(app)],
 ['version synchronized',read('apps/api/src/config/version.ts').includes(read('VERSION').trim())]
];
for(const [name,ok] of checks){console.log(`${ok?'PASS':'FAIL'} ${name}`);}
assert.ok(checks.every(x=>x[1]),'P540 invariant failure');
console.log(`P540 static checks: ${checks.filter(x=>x[1]).length}/${checks.length} PASS`);
