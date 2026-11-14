const base=(process.env.API_BASE_URL||'http://localhost:8080').replace(/\/$/,'');let failed=0;
const mustHave=['x-content-type-options','x-frame-options','content-security-policy'];
try{
 const r=await fetch(`${base}/api/health/live`); const h=r.headers;
 for(const name of mustHave){const ok=h.has(name);console.log(`${ok?'PASS':'FAIL'} security header ${name}${ok?'':' missing'}`);if(!ok)failed++}
 const powered=h.get('x-powered-by');const ok=!powered;console.log(`${ok?'PASS':'FAIL'} X-Powered-By disclosure disabled`);if(!ok)failed++;
}catch(e){console.error(`BLOCKED: API unavailable at ${base}: ${e.message}`);process.exit(2)}
console.log(`P508 security header smoke: ${failed?'FAIL':'PASS'} (${failed} failures)`);process.exitCode=failed?1:0;
