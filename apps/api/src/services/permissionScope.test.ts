import { describe, it, expect } from 'vitest';
import { hasPermissionScope } from './permissionScope.js';

describe('P547 outlet permission scope', () => {
  const grants = [
    { permission: 'retail:billing', outletId: 'outlet-a' },
    { permission: 'inventory:read' }
  ];
  it('allows a grant for its matching outlet', () => expect(hasPermissionScope(grants, 'retail:billing', 'outlet-a')).toBe(true));
  it('denies an outlet-specific grant for a different outlet', () => expect(hasPermissionScope(grants, 'retail:billing', 'outlet-b')).toBe(false));
  it('allows an organisation-wide grant without an outlet restriction', () => expect(hasPermissionScope(grants, 'inventory:read', 'outlet-b')).toBe(true));
  it('denies an unknown permission', () => expect(hasPermissionScope(grants, 'finance:manage', 'outlet-a')).toBe(false));
});
