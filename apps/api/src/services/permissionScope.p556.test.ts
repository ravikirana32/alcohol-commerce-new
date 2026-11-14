import { describe, it, expect } from 'vitest';
import { hasPermissionScope } from './permissionScope.js';

describe('P556 outlet and organisation permission boundaries', () => {
  const grants = [
    { permission: 'retail:billing', outletId: 'outlet-a' },
    { permission: 'inventory:read' }
  ];
  it('allows only the matching outlet for an outlet-scoped grant', () => {
    expect(hasPermissionScope(grants, 'retail:billing', 'outlet-a')).toBe(true);
    expect(hasPermissionScope(grants, 'retail:billing', 'outlet-b')).toBe(false);
  });
  it('does not treat an absent requested outlet as a match for an outlet-scoped grant', () => {
    expect(hasPermissionScope(grants, 'retail:billing')).toBe(false);
  });
  it('allows organisation-wide grants across outlets', () => {
    expect(hasPermissionScope(grants, 'inventory:read', 'outlet-b')).toBe(true);
  });
  it('denies unknown permissions and empty grant lists', () => {
    expect(hasPermissionScope(grants, 'finance:manage', 'outlet-a')).toBe(false);
    expect(hasPermissionScope([], 'inventory:read', 'outlet-a')).toBe(false);
  });
});
