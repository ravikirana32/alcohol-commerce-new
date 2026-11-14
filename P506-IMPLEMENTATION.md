# P506 — API integration and concurrency test foundation
Version: 0.506.0-dev

Added an API smoke-test runner for liveness/readiness and the unauthenticated tenant-route boundary. An optional short-lived test token enables an authenticated tenant-route check. Added a concurrency test contract covering duplicate idempotency keys, concurrent partial refunds, over-refund races and duplicate shift opens.

Run `npm run verify:p506`. Set `API_BASE_URL` and optionally `P506_TEST_TOKEN` for a running disposable test environment. This phase does not claim concurrent database tests passed; those require a provisioned PostgreSQL instance and test fixtures.
