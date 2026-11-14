import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';

describe('health endpoints', () => {
  it('returns liveness', async () => {
    const response = await request(app).get('/api/health/live');
    expect(response.status).toBe(200);
    expect(response.body.status).toBe('live');
  });
});
