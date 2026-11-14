# P568 Release Notes

## Added
- Idempotency-Key support for manual stock receipt and manual stock adjustment.
- Idempotency-Key support for open-bottle creation with original bottle replay lookup.
- Goods-receipt request-level idempotency with payload fingerprint and organisation/outlet unique index.
- Migration 244 and P568 static verifier.

## Changed
- Manual stock balance mutations now occur only when the append-once movement is newly created.
- P565/P567 static verifiers recognise the new append-once integration.
- API clients must send stable Idempotency-Key headers for the four request types.

## Known limitations
Runtime database, concurrency, Vitest, semantic typecheck, browser E2E, tenant IDOR and penetration tests are not complete. Production remains NO-GO.
