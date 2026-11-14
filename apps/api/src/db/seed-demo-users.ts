import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { pool } from './pool.js';

/**
 * Local-development demo seeder. It is intentionally blocked in production and
 * requires an explicit opt-in plus an operator-supplied password.
 */
const enabled = process.env.DEMO_SEED_ENABLED === 'true';
const nodeEnv = process.env.NODE_ENV ?? 'development';
const password = process.env.DEMO_SEED_PASSWORD ?? '';

if (nodeEnv === 'production') {
  console.error('Refusing to seed demo users when NODE_ENV=production.');
  process.exitCode = 1;
} else if (!enabled) {
  console.error('Demo seeding is disabled. Set DEMO_SEED_ENABLED=true for a local development database.');
  process.exitCode = 1;
} else if (password.length < 14 || password.length > 128) {
  console.error('DEMO_SEED_PASSWORD must be 14–128 characters. Supply it through your local .env file.');
  process.exitCode = 1;
} else {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const existingOrg = await client.query(
      `SELECT id FROM organisations WHERE display_name='ACP Local Demo' ORDER BY created_at LIMIT 1`
    );
    let organisationId: string;
    if (existingOrg.rowCount) {
      organisationId = existingOrg.rows[0].id;
      await client.query(
        `UPDATE organisations SET status='ACTIVE', organisation_profile='HYBRID', updated_at=NOW() WHERE id=$1`,
        [organisationId]
      );
    } else {
      const createdOrg = await client.query(
        `INSERT INTO organisations (legal_name, display_name, name, organisation_type, status, country_code, organisation_profile)
         VALUES ('ACP Local Demo Organisation Pvt Ltd', 'ACP Local Demo', 'ACP Local Demo', 'RETAILER', 'ACTIVE', 'IN', 'HYBRID')
         RETURNING id`
      );
      organisationId = createdOrg.rows[0].id;
    }

    const outletResult = await client.query(
      `INSERT INTO outlets (organisation_id, outlet_code, name, operating_mode, state_code, status)
       VALUES ($1, 'DEMO-001', 'ACP Demo Outlet', 'HYBRID', 'KA', 'ACTIVE')
       ON CONFLICT (organisation_id, outlet_code) DO UPDATE SET name=EXCLUDED.name
       RETURNING id`, [organisationId]
    );
    const outletId = outletResult.rows[0].id as string;
    const rolesResult = await client.query(
      `SELECT DISTINCT role_code FROM role_permissions WHERE role_code <> '' ORDER BY role_code`
    );
    const roleCodes = new Set<string>(rolesResult.rows.map((row) => String(row.role_code)));
    roleCodes.add('PLATFORM_ADMIN');
    const passwordHash = await bcrypt.hash(password, 12);
    const credentials: Array<{ role: string; email: string }> = [];

    for (const roleCode of [...roleCodes].sort()) {
      const slug = roleCode.toLowerCase().replace(/[^a-z0-9]+/g, '.').replace(/^\.|\.$/g, '');
      const email = `${slug}@demo.acp.local`;
      const displayName = `Demo ${roleCode.replace(/_/g, ' ')}`;
      const platformAdmin = roleCode === 'PLATFORM_ADMIN';
      const userResult = await client.query(
        `INSERT INTO users (email, display_name, password_hash, status, is_platform_admin)
         VALUES ($1, $2, $3, 'ACTIVE', $4)
         ON CONFLICT (email) DO UPDATE SET display_name=EXCLUDED.display_name,
           password_hash=EXCLUDED.password_hash, status='ACTIVE', is_platform_admin=EXCLUDED.is_platform_admin,
           password_changed_at=NOW(), updated_at=NOW()
         RETURNING id`, [email, displayName, passwordHash, platformAdmin]
      );
      const userId = userResult.rows[0].id as string;
      if (!platformAdmin) {
        await client.query(
          `INSERT INTO organisation_memberships (user_id, organisation_id, role_code, status)
           VALUES ($1, $2, $3, 'ACTIVE')
           ON CONFLICT (user_id, organisation_id) DO UPDATE SET role_code=EXCLUDED.role_code, status='ACTIVE'`,
          [userId, organisationId, roleCode]
        );
        await client.query(
          `INSERT INTO user_outlet_access (user_id, outlet_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
          [userId, outletId]
        );
      }
      credentials.push({ role: roleCode, email });
    }

    await client.query('COMMIT');
    console.log(`Seeded ${credentials.length} local demo role accounts.`);
    console.log(`Demo organisation: ${organisationId}`);
    console.log(`Demo outlet: ${outletId}`);
    console.log('Role accounts (shared local credential):');
    for (const item of credentials) console.log(`${item.role}\t${item.email}`);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Demo user seeding failed:', error instanceof Error ? error.message : 'unknown error');
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

if (process.exitCode) await pool.end();
