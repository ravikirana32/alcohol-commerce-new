# P506 Test Plan
Run `npm run verify:p506:static` without services. Run `npm run verify:p506` with API running. Optional token: `P506_TEST_TOKEN`.
Database concurrency scenarios for the disposable integration environment: same idempotency key/same payload; same key/different payload; concurrent partial refunds; over-refund race; simultaneous shift-open requests. Acceptance: no duplicate postings, no cross-tenant reads, no negative refundable balance. These database scenarios remain pending live execution.
