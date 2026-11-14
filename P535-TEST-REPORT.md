# P535 Test Report

**Version:** 0.535.0-dev

## Executed

- P535 static invariants: 14/14 PASS.
- TypeScript syntax transpilation: 255 source files, 0 syntax diagnostics.
- SQL migration static validation: 237 ordered migration files PASS.
- HMAC SHA-256 primitive known-path self-test: PASS.
- P535 migration includes provider event idempotency, tender states, cash counts, gross-fee-net constraint, settlement items and exception ledger: PASS.
- Static checks confirm raw-body middleware precedes JSON parsing, signed evidence intake, offline non-confirmation, settlement exact-match requirement, bank amount guard and absence of live capture: PASS.

## Not run / blocked

- PostgreSQL clean install, P534-to-P535 upgrade, migration 237 execution, rollback/reapply, FK/check/unique/index behavior: NOT RUN (PostgreSQL runtime unavailable in this environment).
- API integration tests against real PostgreSQL: NOT RUN.
- Provider sandbox webhook signature fixtures and provider-specific canonicalization: NOT RUN.
- Duplicate webhook race, concurrent settlement match, cash count race, tenant IDOR and permission matrix: NOT RUN.
- Browser/admin UI: NOT IMPLEMENTED in P535; no browser acceptance run.
- Checkout automatic tender allocation integration: NOT COMPLETE.
- Refund/split-tender routing, chargeback and MDR/bank statement full lifecycle: PARTIAL / OPEN.
- Full semantic TypeScript typecheck, Vitest and Playwright: NOT RUN (dependency/runtime environment unavailable).

Static PASS is not equivalent to runtime, security, finance, provider certification, or production acceptance.
