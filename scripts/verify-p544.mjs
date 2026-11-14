import fs from 'node:fs';
import path from 'node:path';
import { parseEnv, evaluateEnvironment } from './verify-p544-environment.mjs';
const root = process.cwd();
const envExample = parseEnv(fs.readFileSync(path.join(root, '.env.example'), 'utf8'));
const compose = fs.readFileSync(path.join(root, 'docker-compose.yml'), 'utf8');
const goodProd = { NODE_ENV:'production', DATABASE_URL:'postgresql://svc:strong@db.internal:5432/acp', JWT_SECRET:'a'.repeat(48), WEB_ORIGIN:'https://pos.example.com', BOOTSTRAP_SECRET:'b'.repeat(48), SECURE_COOKIE_AUTH:'true', POSTGRES_PASSWORD:'c'.repeat(32), PAYMENT_LIVE_MODE:'false', OFFLINE_SYNC_ENABLED:'false' };
const badProd = { ...goodProd, WEB_ORIGIN:'http://localhost:5173', JWT_SECRET:'replace-with-at-least-32-random-bytes', SECURE_COOKIE_AUTH:'false' };
const checks = [
 ['Environment parser reads sample configuration', envExample.NODE_ENV === 'development' && envExample.AI_FEATURES_ENABLED === 'false'],
 ['Valid production fixture passes', evaluateEnvironment(goodProd).ready],
 ['Weak JWT secret rejected', evaluateEnvironment({...goodProd, JWT_SECRET:'short'}).issues.some(x=>x.code==='JWT_SECRET_TOO_SHORT')],
 ['Invalid database URL rejected', evaluateEnvironment({...goodProd, DATABASE_URL:'mysql://db/acp'}).issues.some(x=>x.code==='DATABASE_URL_SCHEME')],
 ['Production HTTP origin rejected', evaluateEnvironment(badProd).issues.some(x=>x.code==='PRODUCTION_WEB_ORIGIN_NOT_HTTPS')],
 ['Production placeholder secret rejected', evaluateEnvironment(badProd).issues.some(x=>x.code==='PLACEHOLDER_SECRET')],
 ['Invalid port rejected', evaluateEnvironment({...goodProd, API_PORT:'70000'}).issues.some(x=>x.code==='PORT_INVALID')],
 ['Compose binds published ports to loopback by default', /127\.0\.0\.1:\$\{API_PORT/.test(compose) && /127\.0\.0\.1:\$\{WEB_PORT/.test(compose)],
 ['Compose migration gates API startup', /condition: service_completed_successfully/.test(compose)],
 ['Compose API readiness healthcheck exists', /api\/health\/ready/.test(compose)],
 ['Runtime smoke checks include API, DB readiness and web', fs.readFileSync(path.join(root,'scripts/smoke-p544.mjs'),'utf8').includes("API readiness (database included)") && fs.readFileSync(path.join(root,'scripts/smoke-p544.mjs'),'utf8').includes('Web root')],
 ['P544 runbooks and evidence files exist', ['doc-new/P544-ENVIRONMENT-READINESS.md','doc-new/P544-RUNTIME-VALIDATION.md','doc-new/P544-STATUS.md','doc-new/P544-IMPLEMENTATION.md','doc-new/P544-TEST-REPORT.md'].every(f=>fs.existsSync(path.join(root,f)))],
 ['Production-sensitive features default off in sample env', ['AI_FEATURES_ENABLED','OFFLINE_SYNC_ENABLED','PAYMENT_LIVE_MODE','NOTIFICATIONS_LIVE_MODE'].every(k=>envExample[k]==='false')]
];
let failed=0;
for (const [name,ok] of checks) { console.log(`${ok?'PASS':'FAIL'} ${name}`); if(!ok) failed++; }
console.log(`P544 deterministic checks: ${checks.length-failed}/${checks.length} PASS`);
if(failed) process.exitCode=1;
