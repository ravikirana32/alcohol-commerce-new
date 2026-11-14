export type OperationalCapability = 'RETAIL_SALE' | 'BAR_SERVICE';

type Queryable = {
  query: (sql: string, values?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }>;
};

export type OutletAccessResult =
  | { allowed: true; outletId: string; organisationId: string; operatingMode: string }
  | { allowed: false; code: 'OUTLET_NOT_FOUND' | 'OUTLET_NOT_ACTIVE' | 'OPERATING_MODE_NOT_PERMITTED' | 'LICENCE_NOT_VERIFIED'; message: string };

/**
 * Enforces outlet activation, operating profile and a current VERIFIED licence
 * whose permitted_activities contains the requested capability.
 * Both outlet and matching licence rows are locked to prevent a concurrent
 * suspension/review from racing a checkout transaction.
 */
export async function checkOutletOperationalAccess(
  db: Queryable,
  organisationId: string,
  outletId: string,
  capability: OperationalCapability,
  actor?: { userId: string; roleCode: string | null }
): Promise<OutletAccessResult> {
  const result = await db.query(
    `SELECT id, organisation_id, status, operating_mode
       FROM outlets
      WHERE id = $1 AND organisation_id = $2
      FOR UPDATE`,
    [outletId, organisationId]
  );
  const outlet = result.rows[0];
  if (!outlet) {
    return { allowed: false, code: 'OUTLET_NOT_FOUND', message: 'Outlet is not part of this organisation' };
  }
  if (outlet.status !== 'ACTIVE') {
    return { allowed: false, code: 'OUTLET_NOT_ACTIVE', message: 'Outlet must be active before transactions are allowed' };
  }
  // Owners manage all outlets in their organisation; operational staff must be explicitly assigned.
  if (actor && !['RETAIL_OWNER','BAR_OWNER'].includes(actor.roleCode ?? '')) {
    const assigned = await db.query('SELECT 1 FROM user_outlet_access WHERE user_id=$1 AND outlet_id=$2', [actor.userId, outletId]);
    if (!assigned.rowCount) {
      return { allowed: false, code: 'OUTLET_NOT_FOUND', message: 'User is not assigned to this outlet' };
    }
  }
  const modeAllows = capability === 'RETAIL_SALE'
    ? ['RETAIL_ONLY', 'HYBRID'].includes(outlet.operating_mode)
    : ['BAR_ONLY', 'HYBRID'].includes(outlet.operating_mode);
  if (!modeAllows) {
    return { allowed: false, code: 'OPERATING_MODE_NOT_PERMITTED', message: 'Outlet operating mode does not permit this activity' };
  }

  const licence = await db.query(
    `SELECT id
       FROM outlet_licences
      WHERE outlet_id = $1
        AND organisation_id = $2
        AND status = 'VERIFIED'
        AND (valid_from IS NULL OR valid_from <= CURRENT_DATE)
        AND (valid_until IS NULL OR valid_until >= CURRENT_DATE)
        AND permitted_activities @> ARRAY[$3]::text[]
      ORDER BY reviewed_at DESC NULLS LAST
      LIMIT 1
      FOR UPDATE`,
    [outletId, organisationId, capability]
  );
  if (!licence.rowCount) {
    return { allowed: false, code: 'LICENCE_NOT_VERIFIED', message: 'A current verified licence with the required activity is mandatory' };
  }
  return {
    allowed: true,
    outletId: outlet.id,
    organisationId: outlet.organisation_id,
    operatingMode: outlet.operating_mode
  };
}
