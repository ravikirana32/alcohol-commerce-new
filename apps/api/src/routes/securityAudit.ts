import { Router } from 'express';
import { pool } from '../db/pool.js';
import { authenticate } from '../middleware/authenticate.js';
import { requireOrgScope } from '../middleware/requireOrgScope.js';
import { requirePermission } from '../middleware/requirePermission.js';

export const securityAuditRouter = Router();
securityAuditRouter.use(authenticate, requireOrgScope);
securityAuditRouter.get('/security/audit-events', requirePermission('security:audit:read'), async (req: any, res: any) => {
  const limit = Math.min(200, Math.max(1, Number.parseInt(String(req.query.limit ?? '100'), 10) || 100));
  const before = req.query.before ? new Date(String(req.query.before)) : null;
  if (before && Number.isNaN(before.getTime())) return res.status(400).json({ error: { code: 'INVALID_CURSOR', message: 'before must be a valid timestamp.' } });
  const r = await pool.query(`SELECT id,actor_user_id,event_code,resource_type,resource_id,outcome,request_id,source_ip,metadata,occurred_at
    FROM security_audit_events WHERE organisation_id=$1 AND ($2::timestamptz IS NULL OR occurred_at<$2)
    ORDER BY occurred_at DESC LIMIT $3`, [req.auth.organisationId, before, limit]);
  res.json({ data: r.rows, appendOnly: true });
});
