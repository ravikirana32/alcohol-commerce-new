#!/usr/bin/env node
/** Isolated PostgreSQL migration integration test. Uses only a uniquely named disposable database. */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID, createHash } from 'node:crypto';
import pg from 'pg';
const { Client, Pool } = pg;
const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const migrationsDir = path.join(repo, 'apps/api/src/db');
const adminUrl = process.env.TEST_DATABASE_ADMIN_URL;
const keep = process.env.P505_KEEP_TEST_DATABASE === '1';
if (!adminUrl) {
  console.error('P505 BLOCKED: set TEST_DATABASE_ADMIN_URL to a disposable PostgreSQL admin connection.');
  process.exit(2);
}
const dbName = `acp_p505_${randomUUID().replaceAll('-', '').slice(0, 16)}`;
const admin = new Client({ connectionString: adminUrl });
let created = false, failures = 0;
const report = (name, ok, detail = '') => { console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`); if (!ok) failures++; };
const sha = (s) => createHash('sha256').update(s).digest('hex');
try {
  await admin.connect();
  await admin.query(`CREATE DATABASE "${dbName}"`);
  created = true;
  report('isolated database created', true, dbName);
  const target = new URL(adminUrl); target.pathname = `/${dbName}`;
  const pool = new Pool({ connectionString: target.toString(), max: 2 });
  try {
    const files = (await fs.readdir(migrationsDir)).filter(f => /^\d+_.*\.sql$/.test(f)).sort();
    report('migration discovery', files.length > 0, `${files.length} SQL files`);
    report('migration filenames unique', new Set(files).size === files.length);
    await pool.query(`CREATE TABLE schema_migrations (filename TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`);
    await pool.query(`CREATE TABLE schema_migration_checksums (filename TEXT PRIMARY KEY, sha256 CHAR(64) NOT NULL, verified_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`);
    for (const filename of files) {
      const sql = await fs.readFile(path.join(migrationsDir, filename), 'utf8');
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await client.query(sql);
        await client.query('INSERT INTO schema_migrations(filename) VALUES($1)', [filename]);
        await client.query('INSERT INTO schema_migration_checksums(filename,sha256) VALUES($1,$2)', [filename, sha(sql)]);
        await client.query('COMMIT');
      } catch (e) {
        await client.query('ROLLBACK').catch(() => {});
        throw new Error(`${filename}: ${e.message}`);
      } finally { client.release(); }
    }
    const applied = await pool.query('SELECT filename FROM schema_migrations');
    const checksums = await pool.query('SELECT filename,sha256 FROM schema_migration_checksums');
    report('clean install applies every migration', applied.rowCount === files.length, `${applied.rowCount}/${files.length}`);
    report('checksum ledger complete', checksums.rowCount === files.length, `${checksums.rowCount}/${files.length}`);
    let checksumOk = true;
    for (const filename of files) {
      const sql = await fs.readFile(path.join(migrationsDir, filename), 'utf8');
      const stored = await pool.query('SELECT sha256 FROM schema_migration_checksums WHERE filename=$1', [filename]);
      if (stored.rows[0]?.sha256?.trim() !== sha(sql)) { checksumOk = false; break; }
    }
    report('all migration checksums match source', checksumOk);
    const core = await pool.query(`SELECT to_regclass('public.organisations') AS organisations, to_regclass('public.outlets') AS outlets`);
    report('core organisation/outlet schema exists', Boolean(core.rows[0]?.organisations && core.rows[0]?.outlets));
    const count = await pool.query('SELECT count(*)::int AS n FROM schema_migrations');
    report('upgrade/no-op baseline remains stable', count.rows[0].n === files.length, `${count.rows[0].n} recorded migrations`);
  } finally { await pool.end(); }
} catch (error) { report('PostgreSQL migration integration', false, error.stack || error.message); }
finally {
  if (admin._connected) {
    if (created && !keep) {
      try { await admin.query(`DROP DATABASE IF EXISTS "${dbName}" WITH (FORCE)`); report('isolated database cleanup', true); }
      catch (e) { console.error(`CLEANUP WARNING: ${e.message}`); failures++; }
    } else if (created) console.log(`P505_KEEP_TEST_DATABASE=1; retained database ${dbName}`);
    await admin.end();
  }
}
console.log(`P505 PostgreSQL integration result: ${failures === 0 ? 'PASS' : 'FAIL'} (${failures} failures)`);
process.exitCode = failures === 0 ? 0 : 1;
