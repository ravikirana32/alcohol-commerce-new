import { describe, it, expect } from 'vitest';
import { assertSameTenant } from './tenantBoundary.js';

describe('P556 tenant resource boundary', () => {
  it('accepts a resource owned by the actor organisation', () => {
    expect(assertSameTenant('org-a', 'org-a')).toBe(true);
  });
  it('rejects a resource owned by another organisation', () => {
    expect(() => assertSameTenant('org-a', 'org-b')).toThrow('Tenant boundary violation');
  });
  it('rejects a missing actor organisation', () => {
    expect(() => assertSameTenant('', 'org-a')).toThrow('Tenant boundary violation');
  });
  it('rejects a missing resource organisation', () => {
    expect(() => assertSameTenant('org-a', '')).toThrow('Tenant boundary violation');
  });
  it('rejects null-like identifiers at runtime', () => {
    expect(() => assertSameTenant(undefined as unknown as string, 'org-a')).toThrow('Tenant boundary violation');
  });
});
