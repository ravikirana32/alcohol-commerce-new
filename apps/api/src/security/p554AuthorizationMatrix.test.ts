import { describe, it, expect } from 'vitest';
import express from 'express';
import request from 'supertest';
import fs from 'node:fs';
import path from 'node:path';
import { requirePermission } from '../middleware/requirePermission.js';

type Matrix = { roles: Record<string, string[]> };
const matrix = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), 'src/authz/permission-matrix.generated.json'), 'utf8')) as Matrix;

function appForRole(role: string) {
  const app = express();
  const permissions = matrix.roles[role] ?? [];
  app.use((req, _res, next) => {
    // Test-only identity injection. This does not exercise JWT/session authentication.
    (req as express.Request).auth = {
      userId: 'test-user',
      email: 'test@example.local',
      displayName: 'Test User',
      isPlatformAdmin: role === 'PLATFORM_ADMIN',
      organisationId: 'test-organisation',
      roleCode: role,
      sessionId: 'test-session',
      permissions
    };
    next();
  });
  const all = [...new Set(Object.values(matrix.roles).flat())].sort();
  for (const permission of all) {
    app.get(`/protected/${encodeURIComponent(permission)}`, requirePermission(permission), (_req, res) => res.status(200).json({ ok: true, permission }));
  }
  return app;
}

describe('P554 authenticated API authorization matrix (middleware harness)', () => {
  const roles = Object.keys(matrix.roles).sort();
  const permissions = [...new Set(Object.values(matrix.roles).flat())].sort();
  it('loads a non-empty role and permission matrix', () => {
    expect(roles.length).toBeGreaterThan(0);
    expect(permissions.length).toBeGreaterThan(0);
  });
  it.each(roles)('%s receives 200 only for its exact grants and 403 for all others', async (role) => {
    const granted = new Set(matrix.roles[role]);
    const app = appForRole(role);
    for (const permission of permissions) {
      const response = await request(app).get(`/protected/${encodeURIComponent(permission)}`);
      expect(response.status, `${role} -> ${permission}`).toBe(granted.has(permission) ? 200 : 403);
      if (!granted.has(permission)) expect(response.body).toMatchObject({ error: { code: 'PERMISSION_DENIED' } });
    }
  });
  it('does not allow unauthenticated requests', async () => {
    const app = express();
    app.get('/protected', requirePermission(permissions[0]), (_req, res) => res.sendStatus(200));
    const response = await request(app).get('/protected');
    expect(response.status).toBe(401);
    expect(response.body).toMatchObject({ error: { code: 'AUTH_REQUIRED' } });
  });
});
