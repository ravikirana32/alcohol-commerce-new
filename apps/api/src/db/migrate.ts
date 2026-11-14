import 'dotenv/config';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pool } from './pool.js';
import { createHash } from 'node:crypto';

const here = path.dirname(fileURLToPath(import.meta.url));
const migrationsDir = path.resolve(here, '../..', 'src/db');
const client = await pool.connect();

try {
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await client.query(`CREATE TABLE IF NOT EXISTS schema_migration_checksums (filename TEXT PRIMARY KEY, sha256 CHAR(64) NOT NULL, verified_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`);
  const files = (await fs.readdir(migrationsDir))
    .filter((name) => /^\d+_.*\.sql$/.test(name))
    .sort();

  for (const filename of files) {
    const sql = await fs.readFile(path.join(migrationsDir, filename), 'utf8');
    const sha256 = createHash('sha256').update(sql).digest('hex');
    const exists = await client.query('SELECT 1 FROM schema_migrations WHERE filename = $1', [filename]);
    if (exists.rowCount) {
      const prior = await client.query('SELECT sha256 FROM schema_migration_checksums WHERE filename=$1', [filename]);
      if (prior.rowCount && prior.rows[0].sha256.trim() !== sha256) {
        throw new Error(`Migration checksum mismatch for ${filename}; do not edit an applied migration. Create a forward migration instead.`);
      }
      if (!prior.rowCount) await client.query('INSERT INTO schema_migration_checksums(filename,sha256) VALUES($1,$2) ON CONFLICT(filename) DO NOTHING', [filename,sha256]);
      console.log(`SKIP ${filename}`);
      continue;
    }
    await client.query('BEGIN');
    try {
      await client.query(sql);
      await client.query('INSERT INTO schema_migrations(filename) VALUES ($1)', [filename]);
      await client.query('INSERT INTO schema_migration_checksums(filename,sha256) VALUES($1,$2)', [filename,sha256]);
      await client.query('COMMIT');
      console.log(`APPLIED ${filename}`);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    }
  }
} finally {
  client.release();
  await pool.end();
}
