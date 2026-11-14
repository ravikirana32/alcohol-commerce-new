import { describe, expect, it, vi } from 'vitest';
import { checkOutletOperationalAccess } from '../src/services/outletOperationalAccess.js';

function fakeDb(outlet: Record<string, unknown> | null, licence: boolean) {
  const responses = [
    { rows: outlet ? [outlet] : [], rowCount: outlet ? 1 : 0 },
    { rows: licence ? [{ id: 'licence-1' }] : [], rowCount: licence ? 1 : 0 }
  ];
  return { query: vi.fn(async () => responses.shift() ?? { rows: [], rowCount: 0 }) };
}

const activeHybrid = { id: 'outlet-1', organisation_id: 'org-1', status: 'ACTIVE', operating_mode: 'HYBRID' };

describe('checkOutletOperationalAccess', () => {
  it('rejects an outlet outside the organisation', async () => {
    const db = fakeDb(null, false);
    const result = await checkOutletOperationalAccess(db, 'org-1', 'outlet-1', 'RETAIL_SALE');
    expect(result).toMatchObject({ allowed: false, code: 'OUTLET_NOT_FOUND' });
  });

  it('rejects outlets that are not active', async () => {
    const db = fakeDb({ ...activeHybrid, status: 'PENDING' }, true);
    const result = await checkOutletOperationalAccess(db, 'org-1', 'outlet-1', 'RETAIL_SALE');
    expect(result).toMatchObject({ allowed: false, code: 'OUTLET_NOT_ACTIVE' });
    expect(db.query).toHaveBeenCalledTimes(1);
  });

  it('rejects a bar service capability on a retail-only outlet', async () => {
    const db = fakeDb({ ...activeHybrid, operating_mode: 'RETAIL_ONLY' }, true);
    const result = await checkOutletOperationalAccess(db, 'org-1', 'outlet-1', 'BAR_SERVICE');
    expect(result).toMatchObject({ allowed: false, code: 'OPERATING_MODE_NOT_PERMITTED' });
    expect(db.query).toHaveBeenCalledTimes(1);
  });

  it('rejects missing, expired or unverified licence permission', async () => {
    const db = fakeDb(activeHybrid, false);
    const result = await checkOutletOperationalAccess(db, 'org-1', 'outlet-1', 'BAR_SERVICE');
    expect(result).toMatchObject({ allowed: false, code: 'LICENCE_NOT_VERIFIED' });
    expect(db.query).toHaveBeenLastCalledWith(expect.stringContaining("status = 'VERIFIED'"), ['outlet-1', 'org-1', 'BAR_SERVICE']);
  });

  it('locks and accepts a current verified licence for the permitted operating mode', async () => {
    const db = fakeDb(activeHybrid, true);
    const result = await checkOutletOperationalAccess(db, 'org-1', 'outlet-1', 'BAR_SERVICE');
    expect(result).toMatchObject({ allowed: true, outletId: 'outlet-1', operatingMode: 'HYBRID' });
    expect(db.query).toHaveBeenCalledTimes(2);
    expect(db.query).toHaveBeenLastCalledWith(expect.stringContaining('FOR UPDATE'), ['outlet-1', 'org-1', 'BAR_SERVICE']);
  });
});
