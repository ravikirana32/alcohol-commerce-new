# P514 Runbook — Organisation, Outlet and Access

## Prerequisites

- Node.js >=20.18 and npm >=10.8.
- Docker Engine / Docker Compose plugin.
- PostgreSQL and Redis via the supplied Compose stack.
- Copy `.env.example` to `.env` and set strong unique `JWT_SECRET`, `BOOTSTRAP_SECRET`, PostgreSQL credentials and allowed web origin. Never commit `.env`.

## Start and migrate

```bash
npm install
npm run version:sync
npm run docker:up
npm run db:status
npm run db:migrate
npm run dev
```

## P514 workflow

1. Bootstrap the first platform administrator once using `POST /api/v1/auth/bootstrap`.
2. Sign in through the web app.
3. Create an organisation using the platform organisation workflow, then provision an owner membership through the authorised provisioning process.
4. Sign in as the organisation owner and open **Organisation & Team**.
5. Update the organisation profile and create one or more outlets.
6. Submit the outlet licence record. The outlet remains non-operational until platform review marks the licence `VERIFIED` and the outlet is activated.
7. Invite staff. The API returns a one-time invitation token; deliver it through an approved secure channel. Do not log or share it publicly.
8. The invitee accepts at `POST /api/v1/organisation/invitations/accept` with the token and a new password. Existing users must supply their current password.
9. Assign the member to one or more organisation-owned outlets. Retail/bar checkout by non-owner staff is denied unless explicitly assigned.
10. Review membership and audit events. Suspend or revoke membership when access is no longer required.

## Required runtime checks before phase closure

```bash
npm run verify:p513
npm run verify:p514
npm run typecheck
npm run build
npm test
npm run test:e2e
```

Also execute a clean PostgreSQL migration, invitation create/accept/replay/expiry tests, cross-tenant isolation tests, outlet assignment allow/deny tests, licence verification/expiry tests, and retail/bar checkout regression tests.

## Safety and legal gate

An outlet record or submitted licence is not permission to trade. Actual regulated activities must remain disabled until the relevant licence is verified and applicable Karnataka excise/legal approval is confirmed.
