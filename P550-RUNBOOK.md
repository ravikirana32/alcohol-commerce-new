# P550 Runbook — Action-Level Authorization

## Prerequisites

Use the P546 runbook to configure `DEMO_SEED_ENABLED=true` and a strong local-only `DEMO_SEED_PASSWORD`, start Docker/PostgreSQL, migrate, and seed demo roles. Do not use demo accounts or passwords in production.

## Verify source policy

```bash
npm run verify:p550
npm run verify:p549
npm run verify:p548
npm run check:syntax
npm run verify:migrations
```

## Start local services

```bash
npm install
npm run docker:up
npm run db:migrate
npm run db:seed:demo
npm run dev
```

Open `http://localhost:5173`, sign in with a seeded role email from P546 runbook, and use the locally configured demo password.

## Role/action checks

For each seeded role, record the actual `permissions` array returned by `GET /api/v1/auth/me`. Verify controls are visible only when at least one exact permission in `apps/web/src/actionPermissions.ts` is present. Check at minimum retail/bar checkout, retail/bar refund, inventory receipt/adjustment, procurement manage/approve, and finance manage/period-close.

Then issue direct API requests for both allowed and denied actions. A hidden button is not proof of security: the API must return 403 for a missing permission and must reject foreign organisation/outlet resources. Record request IDs, role, permission set, route, expected status and actual status without storing passwords or tokens.

## Automated permission tests

```bash
npm run test:permissions:p550
```

This command is authored but was not executed in the current build environment.

## Troubleshooting

- If a permitted action is hidden, inspect `/auth/me` and compare exact permission codes with `actionPermissions.ts`.
- If a forbidden action appears, treat as a UI defect and verify backend denial independently.
- If API returns 403 for an intended role, do not grant a broader permission to make the UI work; review the route policy and role grant with the security owner.
