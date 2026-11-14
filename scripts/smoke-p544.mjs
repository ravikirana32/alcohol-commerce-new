const api = (process.env.API_BASE_URL || 'http://127.0.0.1:8080').replace(/\/$/, '');
const web = (process.env.WEB_BASE_URL || 'http://127.0.0.1:5173').replace(/\/$/, '');
const timeoutMs = Number(process.env.SMOKE_TIMEOUT_MS || 5000);
const checks = [
  ['API liveness', `${api}/api/health/live`, r => r.status === 200],
  ['API readiness (database included)', `${api}/api/health/ready`, r => r.status === 200],
  ['API metadata', `${api}/api/meta`, async r => {
    if (r.status !== 200) return false;
    const body = await r.json();
    return body.name === 'Alcohol Commerce Platform API' && Boolean(body.version);
  }],
  ['Web root', `${web}/`, r => r.status === 200]
];
let failed = 0;
for (const [label, url, validate] of checks) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { signal: controller.signal, redirect: 'manual' });
    const ok = await validate(response);
    console.log(`${ok ? 'PASS' : 'FAIL'} ${label} (HTTP ${response.status})`);
    if (!ok) failed++;
  } catch (error) {
    console.log(`FAIL ${label} (${error?.name === 'AbortError' ? 'timeout' : 'unreachable'})`);
    failed++;
  } finally { clearTimeout(timer); }
}
console.log(`P544 runtime smoke: ${checks.length - failed}/${checks.length} PASS`);
if (failed) process.exitCode = 1;
