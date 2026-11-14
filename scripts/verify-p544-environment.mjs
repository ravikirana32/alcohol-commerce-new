import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export function parseEnv(text) {
  const values = {};
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const match = line.match(/^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match) continue;
    let value = match[2].trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    values[match[1]] = value;
  }
  return values;
}

export function evaluateEnvironment(env, mode = env.NODE_ENV || 'development') {
  const issues = [];
  const required = ['DATABASE_URL', 'JWT_SECRET', 'WEB_ORIGIN'];
  for (const key of required) if (!env[key]?.trim()) issues.push({ code: 'MISSING_REQUIRED', key, severity: 'error' });
  if ((env.JWT_SECRET || '').length < 32) issues.push({ code: 'JWT_SECRET_TOO_SHORT', key: 'JWT_SECRET', severity: 'error' });
  if (env.DATABASE_URL) {
    try {
      const u = new URL(env.DATABASE_URL);
      if (!['postgres:', 'postgresql:'].includes(u.protocol)) issues.push({ code: 'DATABASE_URL_SCHEME', key: 'DATABASE_URL', severity: 'error' });
      if (!u.hostname) issues.push({ code: 'DATABASE_URL_HOST', key: 'DATABASE_URL', severity: 'error' });
      if (mode === 'production' && ['localhost', '127.0.0.1', 'postgres'].includes(u.hostname)) issues.push({ code: 'PRODUCTION_DATABASE_HOST_LOCAL', key: 'DATABASE_URL', severity: 'error' });
    } catch { issues.push({ code: 'DATABASE_URL_INVALID', key: 'DATABASE_URL', severity: 'error' }); }
  }
  if (env.WEB_ORIGIN) {
    for (const origin of env.WEB_ORIGIN.split(',').map(x => x.trim()).filter(Boolean)) {
      try {
        const u = new URL(origin);
        if (!['http:', 'https:'].includes(u.protocol) || u.pathname !== '/' || u.search || u.hash) throw new Error('invalid origin');
        if (mode === 'production' && u.protocol !== 'https:') issues.push({ code: 'PRODUCTION_WEB_ORIGIN_NOT_HTTPS', key: 'WEB_ORIGIN', severity: 'error' });
        if (mode === 'production' && ['localhost', '127.0.0.1'].includes(u.hostname)) issues.push({ code: 'PRODUCTION_WEB_ORIGIN_LOCAL', key: 'WEB_ORIGIN', severity: 'error' });
      } catch { issues.push({ code: 'WEB_ORIGIN_INVALID', key: 'WEB_ORIGIN', severity: 'error' }); }
    }
  }
  for (const key of ['API_PORT', 'WEB_PORT', 'POSTGRES_PORT', 'REDIS_PORT']) {
    if (env[key] && (!/^\d+$/.test(env[key]) || Number(env[key]) < 1 || Number(env[key]) > 65535)) issues.push({ code: 'PORT_INVALID', key, severity: 'error' });
  }
  if (mode === 'production') {
    for (const key of ['JWT_SECRET', 'BOOTSTRAP_SECRET', 'POSTGRES_PASSWORD']) {
      if (env[key] && /^(replace-|change-me|password|secret|example)/i.test(env[key])) issues.push({ code: 'PLACEHOLDER_SECRET', key, severity: 'error' });
    }
    if (!env.BOOTSTRAP_SECRET?.trim()) issues.push({ code: 'BOOTSTRAP_SECRET_MISSING', key: 'BOOTSTRAP_SECRET', severity: 'error' });
    if (env.SECURE_COOKIE_AUTH !== 'true') issues.push({ code: 'SECURE_COOKIE_AUTH_DISABLED', key: 'SECURE_COOKIE_AUTH', severity: 'error' });
    if (env.PAYMENT_LIVE_MODE === 'true') issues.push({ code: 'LIVE_PAYMENTS_REQUIRE_SEPARATE_APPROVAL', key: 'PAYMENT_LIVE_MODE', severity: 'error' });
    if (env.OFFLINE_SYNC_ENABLED === 'true') issues.push({ code: 'OFFLINE_SYNC_REQUIRES_SEPARATE_APPROVAL', key: 'OFFLINE_SYNC_ENABLED', severity: 'error' });
  }
  return { ready: issues.length === 0, mode, issues };
}

async function main() {
  const root = process.cwd();
  const arg = process.argv.find(x => x.startsWith('--env-file='));
  const file = arg ? arg.slice('--env-file='.length) : '.env';
  const filePath = path.resolve(root, file);
  if (!fs.existsSync(filePath)) {
    console.error(`NO-GO: environment file not found (${path.relative(root, filePath) || file})`);
    process.exitCode = 2;
    return;
  }
  const result = evaluateEnvironment(parseEnv(fs.readFileSync(filePath, 'utf8')));
  console.log(`Environment mode: ${result.mode}`);
  for (const issue of result.issues) console.log(`${issue.severity.toUpperCase()} ${issue.code} [${issue.key}]`);
  console.log(`Environment preflight: ${result.ready ? 'PASS' : 'NO-GO'} (${result.issues.length} issue(s))`);
  if (!result.ready) process.exitCode = 2;
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) await main();
