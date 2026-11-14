-- Run after migrations and (optionally) after local demo seeding.
-- 1. Migration ledger count and recent applied migrations.
SELECT COUNT(*) AS applied_migration_count FROM schema_migrations;
SELECT filename, applied_at FROM schema_migrations ORDER BY filename DESC LIMIT 15;

-- 2. Active role definitions and permissions.
SELECT role_code, COUNT(*) AS permission_count
FROM role_permissions GROUP BY role_code ORDER BY role_code;

-- 3. Orphan or inactive memberships (expected: zero orphan users/orgs).
SELECT m.id, m.user_id, m.organisation_id, m.role_code
FROM organisation_memberships m
LEFT JOIN users u ON u.id=m.user_id
LEFT JOIN organisations o ON o.id=m.organisation_id
WHERE u.id IS NULL OR o.id IS NULL;

-- 4. Duplicate membership invariant (expected: zero rows).
SELECT user_id, organisation_id, COUNT(*)
FROM organisation_memberships GROUP BY user_id, organisation_id HAVING COUNT(*) > 1;

-- 5. Local demo account inventory; platform admin intentionally has no tenant membership.
SELECT u.email, u.status, u.is_platform_admin, m.role_code, m.status AS membership_status
FROM users u
LEFT JOIN organisation_memberships m ON m.user_id=u.id
WHERE u.email LIKE '%@demo.acp.local'
ORDER BY u.email;
