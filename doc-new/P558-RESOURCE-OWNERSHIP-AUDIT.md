# P558 Resource Ownership Audit

## Scope
Reviewed all 10 declarations from P557's "no explicit scope marker" bucket against their route source files. This phase resolves their classification; it does not claim that every tenant-bearing business resource query has been exhaustively proven safe.

| Route | Classification | Source-level evidence / boundary |
|---|---|---|
| POST `/bootstrap` | Public one-time bootstrap | Requires configured bootstrap secret; serializes first-admin creation with advisory transaction lock; refuses if any user exists. |
| POST `/login` | Public credential authentication | Verifies credentials and derives organisation/role only from active `organisation_memberships`; selected organisation must be an active membership. |
| GET `/me` | Authenticated self-context | `authenticate` middleware; returns `req.auth`, not a client-selected resource. |
| POST `/logout` | Authenticated session revocation | `authenticate` middleware; revokes the current server-side `auth_sessions` row. |
| GET `/capabilities/phases` | Public static capability metadata | Public product metadata, no tenant resource lookup. |
| GET `/live` | Public liveness probe | Process liveness probe. |
| GET `/ready` | Public readiness probe | Readiness probe; no tenant resource access. |
| POST `/organisation/invitations/accept` | Public single-use invitation-token flow | Separate invitation acceptance router; token-backed acceptance resolves the organisation from the invitation record. |
| GET `/operating-modes` | Public static product metadata | Static configuration profiles; source warns these do not confer legal operating authority. |
| GET `/context` | Authenticated token-derived tenant context | `authenticate`; returns organisation from verified `req.auth`, explicitly not from client-supplied organisation headers. |

## Result
All 10 routes now have explicit source-reviewed dispositions. None of these ten is an unclassified tenant-owned business-resource route. This is not a blanket clearance of the remaining 227 API routes: business route handlers, service/repository queries, background jobs and exports still require runtime negative tests.

## Commands
- `npm run audit:p558:ownership`
- `npm run verify:p558:static`
- `npm run verify:p558`

## Runtime acceptance still required
- Execute authenticated foreign-organisation and foreign-outlet IDOR tests against a disposable PostgreSQL-backed deployment.
- Verify invitation token expiry, replay and cross-organisation misuse at runtime.
- Inspect all resource-ID-bearing SQL in services/repositories and background jobs, not just route declaration files.
- Run Playwright and penetration testing before production approval.
