import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { pool } from '../db/pool.js';
import type { AuthPrincipal } from '../auth/types.js';

type TokenClaims = {
  sub: string;
  sid: string;
  email: string;
  name: string;
  platformAdmin: boolean;
  organisationId: string | null;
  roleCode: string | null;
};

export async function authenticate(req: Request, res: Response, next: NextFunction) {
  try {
    const header = req.header('authorization');
    if (!header?.startsWith('Bearer ')) {
      return res.status(401).json({ error: { code: 'AUTH_REQUIRED', message: 'Authentication required' } });
    }
    const secret = process.env.JWT_SECRET;
    if (!secret || secret.length < 32) {
      return res.status(503).json({ error: { code: 'AUTH_NOT_CONFIGURED', message: 'Authentication is not configured' } });
    }

    const token = header.slice(7);
    const claims = jwt.verify(token, secret) as TokenClaims;
    const session = await pool.query(
      `SELECT s.id, s.user_id, s.revoked_at, s.expires_at, u.status,
              u.email, u.display_name, u.is_platform_admin
         FROM auth_sessions s
         JOIN users u ON u.id = s.user_id
        WHERE s.id = $1 AND s.token_id = $2`,
      [claims.sid, claims.sid]
    );

    const row = session.rows[0];
    if (!row || row.revoked_at || new Date(row.expires_at).getTime() <= Date.now() || row.status !== 'ACTIVE') {
      return res.status(401).json({ error: { code: 'SESSION_INVALID', message: 'Session is invalid or expired' } });
    }

    let permissions: string[] = [];
    if (claims.organisationId && claims.roleCode) {
      const membership = await pool.query(
        `SELECT 1 FROM organisation_memberships
          WHERE user_id = $1 AND organisation_id = $2 AND role_code = $3 AND status = 'ACTIVE'`,
        [claims.sub, claims.organisationId, claims.roleCode]
      );
      if (!membership.rowCount) {
        return res.status(403).json({ error: { code: 'MEMBERSHIP_REVOKED', message: 'Organisation access is no longer active' } });
      }
      const result = await pool.query(
        'SELECT permission_code FROM role_permissions WHERE role_code = $1',
        [claims.roleCode]
      );
      permissions = result.rows.map((item) => item.permission_code);
    } else if (claims.platformAdmin) {
      const result = await pool.query(
        'SELECT permission_code FROM role_permissions WHERE role_code = $1',
        ['PLATFORM_ADMIN']
      );
      permissions = result.rows.map((item) => item.permission_code);
    }

    req.auth = {
      userId: claims.sub,
      email: row.email,
      displayName: row.display_name,
      isPlatformAdmin: row.is_platform_admin,
      organisationId: claims.organisationId,
      roleCode: claims.roleCode,
      sessionId: claims.sid,
      permissions
    } satisfies AuthPrincipal;

    return next();
  } catch {
    return res.status(401).json({ error: { code: 'INVALID_TOKEN', message: 'Authentication token is invalid or expired' } });
  }
}
