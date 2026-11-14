# P206–P210 developer runbook

## Prerequisites
- Node.js >=20.18.0 and npm >=10.8.0
- PostgreSQL version supported by your deployment target
- Copy `.env.example` to `.env`; set a unique `JWT_SECRET` and `DATABASE_URL`
- Keep `AI_FEATURES_ENABLED=false`, `OFFLINE_SYNC_ENABLED=false`, `CONSUMER_DISCOVERY_ENABLED=false`, and `PAYMENT_LIVE_MODE=false` until separately reviewed

## Install and verify
```bash
npm install
# Commit the generated package-lock.json; use npm ci in subsequent clean CI builds
npm run check:syntax
npm run typecheck
npm run build
npm test
python3 scripts/verify-migrations.py
```

## Database
```bash
npm run db:status
npm run db:migrate
npm run db:status
```
Run first against a disposable empty database, then against a restored copy of the previous release database. Validate every migration and checksum result before any production rollout.

## Run locally
```bash
npm run dev
```

## New API endpoints
- `POST /api/v1/retail/sales/:saleId/refunds` — controlled partial retail refund; `restock` is optional and proportional
- `POST /api/v1/bar/tickets/:ticketId/refunds` — controlled bar refund; no automatic peg-volume restoration
- `POST /api/v1/shifts/:shiftId/cash-movements` — cash IN/OUT
- `GET /api/v1/shifts/:shiftId/cash-movements` — movement history

## Important caveats
- These changes are developer-preview code, not a certified POS release.
- The migration checksum baseline is established on first observation for older migrations; it cannot prove their pre-existing integrity.
- No live payment-provider refund is triggered; refund rows are operational/accounting records only. Reconcile actual payment settlement separately.
- Bar peg volume is not restored by a bar refund.
- Void workflows, supervisor approval, per-line return selection, cash drawer hardware and full end-to-end reconciliation remain follow-up work.
- Alcohol sale operations must remain blocked until each outlet licence and permitted activity is verified and mapped to local law by qualified reviewers.
