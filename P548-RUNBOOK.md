# P548 Runbook — Role-Based Navigation & Screen Access

## Start and seed demo users

Follow `P546-RUNBOOK.md` first: configure `DEMO_SEED_ENABLED=true` and a strong local-only `DEMO_SEED_PASSWORD`, start Docker/PostgreSQL, run migrations, then run `npm run db:seed:demo`. Do not seed demo accounts in production.

## Start the application

```bash
npm install
npm run dev
```

Web: `http://localhost:5173`  
API: `http://localhost:8080`

## Login and inspect permissions

Use one of the seeded role emails documented in `P546-RUNBOOK.md` and the password configured in `DEMO_SEED_PASSWORD`. The frontend calls `/api/v1/auth/me` and receives `permissions`; navigation is based on these exact permission codes, not merely the role label.

```bash
curl -sS -X POST http://localhost:8080/api/v1/auth/login \
  -H 'content-type: application/json' \
  -d '{"email":"cashier@demo.acp.local","password":"YOUR_DEMO_SEED_PASSWORD"}'

curl -sS http://localhost:8080/api/v1/auth/me \
  -H "authorization: Bearer YOUR_ACCESS_TOKEN"
```

## Verify the P548 implementation

```bash
npm run verify:p548
npm run check:syntax
npm run verify:migrations
```

## Expected navigation examples (must be confirmed against live seeded role permissions)

- CASHIER: Retail POS and permitted operational/read workspaces only.
- BARTENDER: Bar POS and permitted shift/catalogue workspaces only.
- AUDITOR: audit-related capability; no general sales/stock administration unless explicitly granted.
- BRAND_ANALYST: brand/analytics workspaces only where permissions allow.
- PLATFORM_ADMIN: workspaces whose required permission is present in the platform-admin principal.

These are policy expectations, not a claim that every role has been runtime-tested. The actual `permissions` array returned by `/auth/me` is the source of truth.

## Security note

Hiding a navigation item does not protect an API. For every denied screen, also call its API directly and verify the server returns 403. Test cross-organisation and cross-outlet resource identifiers. If a screen's API succeeds without the required permission, treat it as a P0 security defect.
