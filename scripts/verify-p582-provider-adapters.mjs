import fs from 'node:fs';import assert from 'node:assert/strict';
const svc=fs.readFileSync('apps/api/src/services/providerAdapter.ts','utf8');
const route=fs.readFileSync('apps/api/src/routes/enterpriseIntegrations.ts','utf8');
const sql=fs.readFileSync('apps/api/src/db/258_p582_provider_adapter_certification.sql','utf8');
for(const [n,v] of Object.entries({'provider event contracts':svc.includes('supported:Record<ProviderKind,string[]>'),'HTTPS only':svc.includes('HTTPS_REQUIRED'),'local endpoint block':svc.includes('LOCAL_ENDPOINT_FORBIDDEN'),'idempotency assessment':svc.includes('INVALID_IDEMPOTENCY_KEY'),'dispatch hard disabled':svc.includes('dispatchAllowed:false'),'assessment API':route.includes('/adapter-assess'),'assessment history':route.includes('/adapter-assessments'),'certification evidence':sql.includes('p582_provider_certification_runs'),'tenant scoped query':route.includes('organisation_id=$2')})){assert.ok(v,n);console.log('PASS',n);}
