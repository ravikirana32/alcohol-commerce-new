import { Router } from 'express';
import { pool } from '../db/pool.js';
import { isDraining } from '../runtime/state.js';

export const healthRouter = Router();

healthRouter.get('/live', (_req, res) => {
  res.status(200).json({ status: 'live', service: 'api' });
});

healthRouter.get('/ready', async (_req, res) => {
  const checks: Record<string, string> = { http: isDraining() ? 'draining' : 'ok', database: 'unknown' };
  try {
    await pool.query('SELECT 1');
    checks.database = 'ok';
  } catch {
    checks.database = 'failed';
  }
  const ready = Object.values(checks).every((value) => value === 'ok');
  res.status(ready ? 200 : 503).json({ status: ready ? 'ready' : 'not-ready', checks });
});
