import fs from 'node:fs';
import assert from 'node:assert/strict';
const read = (p) => fs.readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const compose = read('docker-compose.yml');
const checks = [
  ['PostgreSQL service and persistent volume', /postgres:\s+[\s\S]*?postgres_data:\/var\/lib\/postgresql\/data/.test(compose)],
  ['Redis service and health check', /redis:\s+[\s\S]*?redis-cli.*ping/.test(compose)],
  ['Migration job gates API startup', /migrate:\s+[\s\S]*?db:migrate/.test(compose) && /service_completed_successfully/.test(compose)],
  ['API readiness health check', /api\/health\/ready/.test(compose)],
  ['Web waits for healthy API', /web:\s+[\s\S]*?service_healthy/.test(compose)],
  ['AI/payment/notification live modes disabled', /AI_FEATURES_ENABLED:\s+"false"/.test(compose) && /PAYMENT_LIVE_MODE:\s+"false"/.test(compose)],
  ['Linux/macOS start script', fs.existsSync(new URL('../scripts/start.sh', import.meta.url))],
  ['Windows PowerShell start script', fs.existsSync(new URL('../scripts/start.ps1', import.meta.url))],
  ['Stop and log scripts', fs.existsSync(new URL('../scripts/stop.sh', import.meta.url)) && fs.existsSync(new URL('../scripts/logs.sh', import.meta.url))],
  ['Docker quickstart documentation', fs.existsSync(new URL('../docs/DOCKER-QUICKSTART.md', import.meta.url))],
];
for (const [name, ok] of checks) { console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`); assert.ok(ok, name); }
console.log(`P504 Docker static verification: ${checks.length}/${checks.length} passed`);
