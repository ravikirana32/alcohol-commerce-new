# P535 Developer Preview Runbook

1. Start from the P534/P535 cumulative project and configure `DATABASE_URL` as documented in `.env.example`.
2. Configure `PAYMENT_WEBHOOK_SECRET_<PROVIDER>` only in a local secret manager/environment for sandbox testing. Never commit secrets.
3. Apply migrations using `npm run db:migrate` from repository root.
4. Run `npm run verify:p535`, `npm run check:syntax`, and `npm run verify:migrations`.
5. Configure provider sandbox webhook URL `/api/v1/payments/provider-webhooks/<provider>` and sign the exact raw request bytes with HMAC SHA-256. Do not point a live provider at this developer-preview endpoint.
6. Authenticate as an appropriately permissioned organisation user for tender allocation, shift cash counts, settlement imports/matching, and exception review.
7. Import settlement batches, run matching, resolve exceptions with reason evidence, and confirm bank payout only after a full match and exact net amount.
8. Treat `RECORDED_OFFLINE` as evidence only. Do not interpret it as payment capture or settlement.

Production deployment is blocked until PostgreSQL upgrade/rollback, provider sandbox certification, security/concurrency/tenant tests, UI acceptance, finance reconciliation, P534 legal/tax gates and operational approvals are complete.
