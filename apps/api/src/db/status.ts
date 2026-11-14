import 'dotenv/config';
import { pool } from './pool.js';

try {
  const result = await pool.query(
    'SELECT filename, applied_at FROM schema_migrations ORDER BY filename'
  );
  for (const row of result.rows) console.log(`${row.filename} | ${row.applied_at}`);
} catch {
  console.error('Migration table not found. Run npm run db:migrate first.');
  process.exitCode = 1;
} finally {
  await pool.end();
}
