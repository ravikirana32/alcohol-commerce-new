const base=(process.env.API_BASE_URL||'http://localhost:8080').replace(/\/$/,'');let failed=0;
async function check(label,fn){try{const d=await fn();console.log(`PASS ${label}${d?` — ${d}`:''}`)}catch(e){failed++;console.log(`FAIL ${label} — ${e.message}`)}}
await check('API liveness',async()=>{const r=await fetch(`${base}/api/health/live`);if(!r.ok)throw Error(`HTTP ${r.status}`);return `HTTP ${r.status}`});
await check('API readiness',async()=>{const r=await fetch(`${base}/api/health/ready`);if(!r.ok)throw Error(`HTTP ${r.status}`);return `HTTP ${r.status}`});
await check('unauthenticated tenant boundary',async()=>{const r=await fetch(`${base}/api/tenant`);if(![401,403].includes(r.status))throw Error(`expected 401/403, got ${r.status}`);return `HTTP ${r.status}`});
if(process.env.P506_TEST_TOKEN)await check('authenticated tenant context',async()=>{const r=await fetch(`${base}/api/tenant`,{headers:{Authorization:`Bearer ${process.env.P506_TEST_TOKEN}`}});if(!r.ok)throw Error(`HTTP ${r.status}`);return 'accepted'});
else console.log('SKIP authenticated tenant context — P506_TEST_TOKEN not supplied');
console.log(`P506 API smoke result: ${failed?'FAIL':'PASS'} (${failed} failures)`);process.exitCode=failed?1:0;
