import fs from 'node:fs';
import path from 'node:path';
const root=process.cwd();
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const compose=read('docker-compose.yml');
const apiDocker=read('apps/api/Dockerfile');
const webDocker=read('apps/web/Dockerfile');
const smoke=read('scripts/smoke-p544.mjs');
const pkg=JSON.parse(read('package.json'));
const checks=[
 ['Compose defines PostgreSQL, Redis, migration, API and web services', ['postgres:','redis:','migrate:','api:','web:'].every(x=>compose.includes('\n  '+x))],
 ['PostgreSQL uses persistent named volume', /postgres_data:\/var\/lib\/postgresql\/data/.test(compose)],
 ['PostgreSQL readiness gates migration service', /postgres:\s*\n\s*condition: service_healthy/.test(compose)],
 ['Migration completion gates API startup', /migrate:\s*\n\s*condition: service_completed_successfully/.test(compose)],
 ['Redis readiness gates API startup', /redis:\s*\n\s*condition: service_healthy/.test(compose)],
 ['Web startup waits for healthy API', /api:\s*\n\s*condition: service_healthy/.test(compose)],
 ['Published service ports bind to loopback', (compose.match(/127\.0\.0\.1:\$\{/g)||[]).length===4],
 ['Live payment and offline sync remain disabled in Compose', /PAYMENT_LIVE_MODE: "false"/.test(compose)&&/OFFLINE_SYNC_ENABLED: "false"/.test(compose)],
 ['API container has healthcheck', /api\/health\/ready/.test(compose)],
 ['Web container has healthcheck', /wget -q -O \/dev\/null http:\/\/127\.0\.0\.1:5173\//.test(compose)],
 ['API Dockerfile exists and explicitly identifies current development command', apiDocker.includes('FROM node:') && apiDocker.includes('\"dev\"') && apiDocker.includes('@acp/api')],
 ['Web Dockerfile exists', webDocker.length>0],
 ['Smoke script checks liveness, readiness, metadata and web', ['API liveness','API readiness (database included)','API metadata','Web root'].every(x=>smoke.includes(x))],
 ['P544 environment verifier is retained', fs.existsSync(path.join(root,'scripts/verify-p544-environment.mjs'))],
 ['P545 runtime runner is present and non-destructive', fs.existsSync(path.join(root,'scripts/run-p545-runtime-validation.sh')) && /docker compose config/.test(read('scripts/run-p545-runtime-validation.sh')) && !/down -v|volume rm/.test(read('scripts/run-p545-runtime-validation.sh'))],
 ['P545 evidence documents are present', ['doc-new/P545-IMPLEMENTATION.md','doc-new/P545-TEST-REPORT.md','doc-new/P545-STATUS.md','doc-new/P545-RUNTIME-VALIDATION.md','doc-new/P545-ROLLBACK.md'].every(f=>fs.existsSync(path.join(root,f)))],
 ['P545 npm commands are registered', ['verify:p545','runtime:p545'].every(k=>Boolean(pkg.scripts[k]))]
];
let fail=0; for(const [label,ok] of checks){console.log(`${ok?'PASS':'FAIL'} ${label}`);if(!ok)fail++;}
console.log(`P545 deterministic deployment checks: ${checks.length-fail}/${checks.length} PASS`);if(fail)process.exitCode=1;
