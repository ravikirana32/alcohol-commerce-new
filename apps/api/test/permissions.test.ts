import { describe, expect, it } from 'vitest';
import express from 'express';
import request from 'supertest';
import { requirePermission } from '../src/middleware/requirePermission.js';

describe('permission middleware', () => {
  it('rejects requests without an authenticated principal', async () => {
    const app = express();
    app.get('/secure', requirePermission('retail:billing'), (_req, res) => res.json({ ok: true }));
    const response = await request(app).get('/secure');
    expect(response.status).toBe(401);
  });

  it('rejects authenticated users without the required permission', async () => {
    const app = express();
    app.use((req, _res, next) => {
      req.auth = {
        userId: 'user-1', email: 'test@example.com', displayName: 'Test',
        isPlatformAdmin: false, organisationId: 'org-1', roleCode: 'CASHIER',
        sessionId: 'session-1', permissions: []
      };
      next();
    });
    app.get('/secure', requirePermission('retail:billing'), (_req, res) => res.json({ ok: true }));
    const response = await request(app).get('/secure');
    expect(response.status).toBe(403);
  });
});
