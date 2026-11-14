# P546 Test Report

## Executed

| Check | Result |
|---|---:|
| P546 static seeder/security invariants | 13/13 PASS |
| TypeScript syntax transpilation | 264 files, 0 diagnostics |
| SQL migration static validation | 242 ordered files PASS |
| Package/version synchronization | PASS (`0.546.0-dev`) |

## Not executed

- PostgreSQL clean install or upgrade migrations.
- `npm run db:seed:demo` against a real database.
- Login verification for each generated role account.
- UI permission/route matrix for all seeded roles.
- Tenant isolation and negative authorization tests.

The seeder's dynamic role discovery means the exact account count is determined by the migrated database's `role_permissions` table. Do not infer a runtime seed count from static source inspection.

## Result

Static checks pass. Runtime database seeding and role-login acceptance remain OPEN pending execution on the user's Docker/PostgreSQL host.
