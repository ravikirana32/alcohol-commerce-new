# P546 Runbook — Database Integrity and Role-Based Demo Users

Version: `0.546.0-dev`  
Baseline: P545  
Scope: local development / QA only. This seeder is not a production user-provisioning mechanism.

## 1. Start the local stack

From the repository root:

```bash
cp .env.example .env
# Edit .env and set unique local values for POSTGRES_PASSWORD, JWT_SECRET and BOOTSTRAP_SECRET.
docker compose up -d --build
```

Wait until services are healthy:

```bash
docker compose ps
 docker compose logs --tail=100 postgres migrate api web
```

The compose `migrate` service runs database migrations before the API starts. If you run outside Docker, install dependencies with `npm ci`, ensure PostgreSQL is reachable, then run `npm run db:migrate`.

## 2. Enable local demo role accounts

Add the following to your untracked local `.env` file (do not commit it):

```dotenv
DEMO_SEED_ENABLED=true
DEMO_SEED_PASSWORD=LocalDemo#ChangeThis2026
```

Use a unique password of at least 14 characters. The example above is a convenience for a disposable local database only. Change it before sharing a QA environment; never reuse it in staging or production.

Run the seeder after migrations:

```bash
npm run db:seed:demo
```

With Docker, run it inside the API container:

```bash
docker compose exec -e DEMO_SEED_ENABLED=true -e DEMO_SEED_PASSWORD='YOUR_LOCAL_PASSWORD' api npm run db:seed:demo --workspace @acp/api
```

The script:
- Reads every distinct role code from `role_permissions` after migrations, and always includes `PLATFORM_ADMIN`.
- Creates one active local demo account per role.
- Creates/reuses the `ACP Local Demo` organisation and `DEMO-001` hybrid outlet.
- Assigns each non-platform role account an active organisation membership and outlet access.
- Marks only `PLATFORM_ADMIN` as a platform administrator; it does not give platform-admin privileges to tenant users.
- Hashes the supplied password using bcrypt cost 12; it never prints passwords or password hashes.
- Uses a transaction and can be rerun to reset demo account passwords and reactivate those demo accounts.

The script refuses to run if `NODE_ENV=production`, if `DEMO_SEED_ENABLED` is not exactly `true`, or if the supplied password is too short/long.

## 3. Demo login details

Open the web application at `http://localhost:5173` (or your configured `WEB_PORT`). Use the normal login screen. All seeded accounts share the exact password supplied as `DEMO_SEED_PASSWORD` at seed time.

| Role | Login email |
|---|---|
| Platform administrator | `platform.admin@demo.acp.local` |
| Retail owner | `retail.owner@demo.acp.local` |
| Retail manager | `retail.manager@demo.acp.local` |
| Cashier | `cashier@demo.acp.local` |
| Bar owner | `bar.owner@demo.acp.local` |
| Bar manager | `bar.manager@demo.acp.local` |
| Bartender | `bartender@demo.acp.local` |
| Outlet manager | `outlet.manager@demo.acp.local` |
| Brand admin | `brand.admin@demo.acp.local` |
| Brand analyst | `brand.analyst@demo.acp.local` |
| Distributor admin | `distributor.admin@demo.acp.local` |
| Sales representative | `sales.rep@demo.acp.local` |
| Auditor | `auditor@demo.acp.local` |

The seeder is driven by the database's `role_permissions` table, so it may create additional role accounts as migrations introduce roles. For the authoritative complete list on your database, run:

```sql
SELECT DISTINCT role_code FROM role_permissions ORDER BY role_code;
```

Email convention for every discovered role: lowercase the role code, replace underscores with dots, then append `@demo.acp.local`. Example: `FINANCE_MANAGER` becomes `finance.manager@demo.acp.local`.

The platform administrator has no organisation membership and signs in without selecting an organisation. Every other seeded account is attached to `ACP Local Demo` and `DEMO-001`; because there is one active membership, login selects it automatically. Login endpoint for API verification: `POST /api/v1/auth/login` with `{ "email": "...", "password": "..." }`.

## 4. Verify seeded users and access

```sql
SELECT u.email, u.is_platform_admin, m.role_code, m.status AS membership_status,
       o.display_name AS organisation, out.name AS outlet
FROM users u
LEFT JOIN organisation_memberships m ON m.user_id = u.id
LEFT JOIN organisations o ON o.id = m.organisation_id
LEFT JOIN user_outlet_access ua ON ua.user_id = u.id
LEFT JOIN outlets out ON out.id = ua.outlet_id
WHERE u.email LIKE '%@demo.acp.local'
ORDER BY u.email;
```

Run static checks:

```bash
npm run verify:p546
npm run check:syntax
npm run verify:migrations
```

The static migration check does not replace execution against PostgreSQL. For runtime evidence, inspect migration history:

```sql
SELECT COUNT(*) AS applied_migrations FROM schema_migrations;
SELECT filename, applied_at FROM schema_migrations ORDER BY filename DESC LIMIT 10;
```

## 5. Disable/remove demo accounts

After QA, disable demo users rather than deleting transactional references:

```sql
UPDATE users SET status='DISABLED', updated_at=NOW()
WHERE email LIKE '%@demo.acp.local';
UPDATE organisation_memberships SET status='REVOKED'
WHERE user_id IN (SELECT id FROM users WHERE email LIKE '%@demo.acp.local');
```

Set `DEMO_SEED_ENABLED=false` or remove the demo seed variables from `.env`. Do not run the seeder against a database containing real users or production data.

## 6. Troubleshooting

- `DEMO_SEED_ENABLED must be true`: set it in the environment of the process running the command; container execution requires `docker compose exec -e ...` as above.
- `DATABASE_URL is required`: run from the API environment or use the API container.
- `relation ... does not exist`: migrations have not completed; run `npm run db:migrate` or inspect the Compose `migrate` service.
- Login returns `NO_ORGANISATION_ACCESS`: check that the role is not `PLATFORM_ADMIN`, that the membership is ACTIVE and that the demo organisation is ACTIVE.
- Login returns invalid credentials: use the exact configured `DEMO_SEED_PASSWORD`; rerun the seeder to reset all demo accounts to that password.

## 7. Security boundary

These accounts are synthetic local fixtures with a shared password. They are intentionally unsuitable for production. Production users must be invited/provisioned through approved identity and organisation-access workflows, with individual credentials, least privilege, MFA policy, audited approvals and secret management. Live payment capture, offline alcohol posting and outbound provider dispatch remain disabled pending their separate gates.

## P547 — Role and permission validation

Run the deterministic RBAC source checks:

```bash
npm run verify:p547
```

Run focused middleware/outlet-scope unit tests (requires installed workspace dependencies):

```bash
npm run test:rbac:p547
```

After starting the local PostgreSQL-backed API, log in with each seeded account and inspect the returned role and permissions:

```bash
curl -sS -X POST http://localhost:8080/api/auth/login \\
  -H 'content-type: application/json' \\
  -d '{"email":"cashier@demo.acp.local","password":"YOUR_DEMO_SEED_PASSWORD"}'
```

Use the returned access token to inspect the authenticated principal:

```bash
curl -sS http://localhost:8080/api/auth/me \\
  -H "authorization: Bearer YOUR_ACCESS_TOKEN"
```

Repeat for each email emitted by `npm run db:seed:demo`. Confirm that `user.roleCode` matches the account's role and that `permissions` matches the role's `role_permissions` rows. For tenant roles, verify that membership revocation immediately causes subsequent authenticated requests to return `403 MEMBERSHIP_REVOKED`. For an endpoint protected by a permission absent from the role, verify `403 PERMISSION_DENIED`; unauthenticated requests should return `401 AUTH_REQUIRED`.

### Role matrix SQL

```sql
SELECT role_code, array_agg(permission_code ORDER BY permission_code) AS permissions
FROM role_permissions
GROUP BY role_code
ORDER BY role_code;
```

### Seeded-account integrity SQL

```sql
SELECT u.email, u.is_platform_admin, u.status,
       m.role_code, m.status AS membership_status,
       COUNT(DISTINCT a.outlet_id) AS outlet_count
FROM users u
LEFT JOIN organisation_memberships m ON m.user_id = u.id
LEFT JOIN user_outlet_access a ON a.user_id = u.id
WHERE u.email LIKE '%@demo.acp.local'
GROUP BY u.id, u.email, u.is_platform_admin, u.status, m.role_code, m.status
ORDER BY u.email;
```

These are runtime acceptance steps, not claims that database login or tenant isolation has already been exercised. Do not use demo accounts in production.
