import assert from 'node:assert/strict';
const base=(process.env.P584_BASE_URL||'').replace(/\/$/,'');
if(!base){console.error('P584_BASE_URL is required; e.g. http://localhost:8080');process.exit(2);}
async function get(path){const r=await fetch(`${base}${path}`,{headers:{'accept':'application/json'}});const body=await r.json().catch(()=>null);return {status:r.status,body};}
const live=await get('/api/health/live');assert.equal(live.status,200,'liveness endpoint must return HTTP 200');
const ready=await get('/api/health/ready');assert.equal(ready.status,200,'readiness endpoint must return HTTP 200');
const meta=await get('/api/meta');assert.equal(meta.status,200,'API metadata endpoint must return HTTP 200');
assert.equal(meta.body?.version?.startsWith('0.585.'),true,'API version must be 0.585.x');
assert.notEqual(meta.body?.featureFlags?.livePayments,true,'live payment flag must remain disabled');
console.log(JSON.stringify({result:'PASS',base,live:live.status,ready:ready.status,metaVersion:meta.body.version,livePayments:meta.body.featureFlags.livePayments},null,2));
