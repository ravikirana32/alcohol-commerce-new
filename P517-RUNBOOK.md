# P517 Table Sessions and KOT — Runbook

## Start

```bash
npm install
cp .env.example .env
# Configure DATABASE_URL, JWT_SECRET and WEB_ORIGIN.
docker compose up -d --build
npm run db:migrate
npm run dev
```

## Static checks

```bash
npm run verify:p517
npm run check:syntax
npm run verify:migrations
npm run verify:p513
npm run verify:p514
npm run verify:p515
npm run verify:p516
```

## Manual acceptance on a non-production test outlet

1. Sign in as a user with bar service permission and an active outlet licence.
2. Open `Tables & KOT`; create a table session with guest count.
3. Confirm a second open session using the same table label is rejected.
4. Open Bar POS, select the table session, add packaged/peg/bottle items and complete checkout with test tender.
5. Confirm the ticket is associated with the selected table session.
6. Confirm one KOT is created for the ticket and each ticket line appears once.
7. Advance KOT through Accepted, Preparing, Ready and Served; verify actor/time audit data.
8. Confirm table cannot close while a KOT is New, Accepted, Preparing or Ready.
9. Open a second table, transfer it to a free table label; verify ticket labels update.
10. Merge one open table into another in the same outlet; verify tickets/KOTs move and guest counts combine.
11. Close the table after all KOTs are Served or Cancelled.
12. Attempt cross-outlet and cross-organisation session IDs; expect rejection.
13. Repeat an uncertain checkout with the same idempotency key; confirm it does not create a second ticket or KOT.
14. Test two users concurrently transferring/merging/closing the same sessions.

## Runtime test commands

```bash
npm run typecheck
npm run build
npm test
npm run test:e2e
```

Do not use live payment capture or live alcohol service until provider, licence, legal, security and operational approvals are independently complete.
