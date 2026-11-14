import { describe, it, expect, vi } from 'vitest';
import type { Request, Response, NextFunction } from 'express';
import { requirePermission } from './requirePermission.js';

function response() {
  const state: { statusCode?: number; body?: unknown } = {};
  const res = {
    status(code: number) { state.statusCode = code; return this; },
    json(body: unknown) { state.body = body; return this; }
  } as unknown as Response;
  return { res, state };
}

describe('P547 role permission middleware', () => {
  it('rejects unauthenticated requests with 401', () => {
    const { res, state } = response();
    const next = vi.fn() as unknown as NextFunction;
    requirePermission('retail:billing')({} as Request, res, next);
    expect(state.statusCode).toBe(401);
    expect(state.body).toMatchObject({ error: { code: 'AUTH_REQUIRED' } });
    expect(next).not.toHaveBeenCalled();
  });

  it('allows a role only when the exact permission is present', () => {
    const { res, state } = response();
    const next = vi.fn() as unknown as NextFunction;
    const req = { auth: { permissions: ['retail:billing'] } } as unknown as Request;
    requirePermission('retail:billing')(req, res, next);
    expect(next).toHaveBeenCalledOnce();
    expect(state.statusCode).toBeUndefined();
  });

  it('rejects missing permission with 403', () => {
    const { res, state } = response();
    const next = vi.fn() as unknown as NextFunction;
    const req = { auth: { permissions: ['inventory:read'] } } as unknown as Request;
    requirePermission('retail:billing')(req, res, next);
    expect(state.statusCode).toBe(403);
    expect(state.body).toMatchObject({ error: { code: 'PERMISSION_DENIED' } });
    expect(next).not.toHaveBeenCalled();
  });

  it('does not treat a similar permission name as a grant', () => {
    const { res, state } = response();
    const next = vi.fn() as unknown as NextFunction;
    const req = { auth: { permissions: ['retail:billing:refund'] } } as unknown as Request;
    requirePermission('retail:billing')(req, res, next);
    expect(state.statusCode).toBe(403);
    expect(next).not.toHaveBeenCalled();
  });
});
