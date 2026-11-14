# P03 — Authentication, RBAC and Tenant Access Foundation

## Implemented scaffold
- `users` with bcrypt password hashes and account status.
- `organisation_memberships` with organisation-specific role codes.
- `role_permissions` baseline permission catalogue.
- `user_outlet_access` for future outlet-level access grants.
- `auth_sessions` with server-side revocation.
- JWT access token validation with session lookup.
- Login, one-time bootstrap, current-user and logout endpoints.
- Permission middleware.
- Organisation context derived from the signed server-issued token.
- Login screen and session-based frontend token storage.

## API endpoints
- `POST /api/v1/auth/bootstrap` — create the first platform admin only; requires `BOOTSTRAP_SECRET`; rejects if any user already exists.
- `POST /api/v1/auth/login` — authenticate email/password.
- `GET /api/v1/auth/me` — authenticated user profile.
- `POST /api/v1/auth/logout` — revoke current server-side session.
- `GET /api/v1/tenant/context` — authenticated tenant/role/permission context.
- `GET /api/health/live` — process liveness.
- `GET /api/health/ready` — database readiness.

## Local setup
1. Copy `.env.example` to `.env`.
2. Replace `JWT_SECRET` with a random secret of at least 32 characters.
3. Set a long one-time `BOOTSTRAP_SECRET`.
4. Run `npm install`.
5. Run `docker compose up -d postgres redis`.
6. Run `npm run db:migrate`.
7. Run `npm run dev`.
8. Bootstrap the first admin using the command below.

```bash
curl -X POST http://localhost:8080/api/v1/auth/bootstrap \
  -H 'Content-Type: application/json' \
  -d '{
    "bootstrapSecret":"YOUR_BOOTSTRAP_SECRET",
    "email":"admin@example.com",
    "displayName":"Platform Administrator",
    "password":"Use-A-Unique-Password-At-Least-12-Chars"
  }'
```

Then sign in through http://localhost:5173.

## Security limitations / next hardening
- This is an initial P03 foundation, not a production-certified identity service.
- The bootstrap secret must be removed/rotated after initial setup.
- Access token is stored in browser sessionStorage in this starter; production should prefer secure, HttpOnly, SameSite cookies with CSRF protection or a carefully reviewed BFF pattern.
- Add login throttling, account lockout, password reset, MFA, email verification, refresh-token rotation and security event alerts.
- Add RLS or equivalent DB-enforced tenant isolation and comprehensive cross-tenant tests before production.
- Permission middleware is available but every business route must explicitly apply it.
- Platform admin can currently bootstrap; organisation invitations and membership administration are not implemented yet.
- No production secrets or real user data should be placed in this local starter.

## Migration ordering
The migration runner applies `001_foundation.sql` followed by `002_auth_tenancy.sql`. The PostgreSQL Docker init script also creates the initial foundation tables on first volume creation; the migration SQL uses idempotent table/index creation so the migration runner can record the same baseline in `schema_migrations`.

## Bootstrap concurrency
The one-time bootstrap endpoint takes a PostgreSQL advisory transaction lock before checking whether a user already exists, preventing concurrent first-admin creation requests from racing.
