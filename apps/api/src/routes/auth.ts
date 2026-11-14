import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { pool } from '../db/pool.js';
import { authenticate } from '../middleware/authenticate.js';

export const authRouter = Router();

const bootstrapSchema = z.object({
  bootstrapSecret: z.string().min(16),
  email: z.string().email().max(254).transform((value) => value.toLowerCase()),
  displayName: z.string().trim().min(2).max(100),
  password: z.string().min(12).max(128)
});

const loginSchema = z.object({
  email: z.string().email().max(254).transform((value) => value.toLowerCase()),
  password: z.string().min(1).max(128),
  organisationId: z.string().uuid().optional()
});

function issueToken(input: {
  userId: string; sessionId: string; email: string; displayName: string;
  platformAdmin: boolean; organisationId: string | null; roleCode: string | null;
}) {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) throw new Error('JWT_SECRET must be at least 32 characters');
  const expiresIn = process.env.JWT_EXPIRES_IN ?? '8h';
  const token = jwt.sign({
    email: input.email,
    name: input.displayName,
    platformAdmin: input.platformAdmin,
    organisationId: input.organisationId,
    roleCode: input.roleCode,
    sid: input.sessionId
  }, secret, { subject: input.userId, jwtid: input.sessionId, expiresIn: expiresIn as jwt.SignOptions['expiresIn'] });
  return token;
}

// One-time first platform-admin bootstrap. Remove/rotate BOOTSTRAP_SECRET after setup.
authRouter.post('/bootstrap', async (req, res) => {
  const parsed = bootstrapSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: { code: 'VALIDATION_ERROR', details: parsed.error.flatten() } });

  const expectedSecret = process.env.BOOTSTRAP_SECRET;
  if (!expectedSecret || parsed.data.bootstrapSecret !== expectedSecret) {
    return res.status(403).json({ error: { code: 'BOOTSTRAP_DENIED', message: 'Bootstrap secret is invalid' } });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock(741902611)');
    const existing = await client.query('SELECT 1 FROM users LIMIT 1');
    if (existing.rowCount) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: { code: 'BOOTSTRAP_ALREADY_USED', message: 'Initial admin has already been created' } });
    }

    const hash = await bcrypt.hash(parsed.data.password, 12);
    const created = await client.query(
      `INSERT INTO users(email, display_name, password_hash, is_platform_admin)
       VALUES ($1, $2, $3, TRUE) RETURNING id, email, display_name`,
      [parsed.data.email, parsed.data.displayName, hash]
    );
    await client.query('COMMIT');
    return res.status(201).json({ data: created.rows[0], message: 'Initial platform administrator created. Sign in to continue.' });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('[bootstrap-error]', error instanceof Error ? error.message : 'unknown');
    return res.status(500).json({ error: { code: 'BOOTSTRAP_FAILED', message: 'Could not create initial administrator' } });
  } finally {
    client.release();
  }
});

authRouter.post('/login', async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: { code: 'VALIDATION_ERROR', details: parsed.error.flatten() } });

  const userResult = await pool.query(
    `SELECT id, email, display_name, password_hash, status, is_platform_admin
       FROM users WHERE email = $1`,
    [parsed.data.email]
  );
  const user = userResult.rows[0];
  if (!user || user.status !== 'ACTIVE' || !(await bcrypt.compare(parsed.data.password, user.password_hash))) {
    return res.status(401).json({ error: { code: 'INVALID_CREDENTIALS', message: 'Email or password is incorrect' } });
  }

  let organisationId: string | null = null;
  let roleCode: string | null = null;
  if (!user.is_platform_admin) {
    const membership = await pool.query(
      `SELECT organisation_id, role_code FROM organisation_memberships
        WHERE user_id = $1 AND status = 'ACTIVE'
        ORDER BY created_at ASC`,
      [user.id]
    );
    if (parsed.data.organisationId) {
      const selected = membership.rows.find((item) => item.organisation_id === parsed.data.organisationId);
      if (!selected) return res.status(403).json({ error: { code: 'NO_ORGANISATION_ACCESS', message: 'No active access to the selected organisation' } });
      organisationId = selected.organisation_id;
      roleCode = selected.role_code;
    } else if (membership.rows.length === 1) {
      organisationId = membership.rows[0].organisation_id;
      roleCode = membership.rows[0].role_code;
    } else if (membership.rows.length > 1) {
      return res.status(409).json({
        error: { code: 'ORGANISATION_SELECTION_REQUIRED', message: 'Select an organisation to continue' },
        data: membership.rows.map((item) => ({ organisationId: item.organisation_id, roleCode: item.role_code }))
      });
    } else {
      return res.status(403).json({ error: { code: 'NO_ORGANISATION_ACCESS', message: 'No active organisation membership exists' } });
    }
  }

  const sessionId = randomUUID();
  const expiresAt = new Date(Date.now() + 8 * 60 * 60 * 1000);
  await pool.query(
    'INSERT INTO auth_sessions(id, user_id, token_id, expires_at) VALUES ($1, $2, $3, $4)',
    [sessionId, user.id, sessionId, expiresAt]
  );
  await pool.query('UPDATE users SET last_login_at = NOW() WHERE id = $1', [user.id]);

  const token = issueToken({
    userId: user.id, sessionId, email: user.email, displayName: user.display_name,
    platformAdmin: user.is_platform_admin, organisationId, roleCode
  });

  return res.json({
    data: {
      accessToken: token,
      tokenType: 'Bearer',
      expiresAt: expiresAt.toISOString(),
      user: {
        id: user.id, email: user.email, displayName: user.display_name,
        isPlatformAdmin: user.is_platform_admin, organisationId, roleCode
      }
    }
  });
});

authRouter.get('/me', authenticate, async (req, res) => {
  return res.json({ data: req.auth });
});

authRouter.post('/logout', authenticate, async (req, res) => {
  await pool.query('UPDATE auth_sessions SET revoked_at = NOW() WHERE id = $1', [req.auth!.sessionId]);
  return res.status(204).send();
});
