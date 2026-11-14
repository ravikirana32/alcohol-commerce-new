# P531 Status

- Version: `0.531.0-dev`.
- Release: PARTIAL / developer preview; not production approved.
- Implemented: offline BAR_CHECKOUT structural validation, P528 bar authoritative checks, P531 transactional posting, PEG millilitre depletion, BOTTLE/PACKAGED stock movements, bar ticket/KOT, idempotency, blocked-intent hold, offline payment evidence state, bottle reservations, reservation release/expiry, reservation-aware online/offline checkout, wastage/breakage/complimentary/adjustment deductions, operator UI.
- Migration: `230_p531_offline_bar_measure_posting.sql`.
- P531 static acceptance: 31/31 PASS.
- P530 regression verifier: 22/22 PASS.
- P528 authoritative verifier: 15/15 PASS.
- P529 approval verifier: 16/16 PASS.
- TypeScript syntax transpilation: 240 files, 0 syntax diagnostics.
- Migration static validation: 230 ordered SQL files PASS.
- Migration preflight reports inherited duplicate numeric prefixes 150, 151, 176 and 223.
- Vitest suite not run: `vitest` executable/dependencies are not installed in this environment.
- Workspace typecheck blocked by missing Express, Zod, PostgreSQL and Node type dependencies; diagnostics are dominated by missing modules/types.
- PostgreSQL clean install/upgrade, API integration, multi-session concurrency, rollback/failure injection, browser E2E, tenant IDOR and physical bar workflow were not run.
- Payment settlement remains pending reconciliation (P535); journals/COGS deferred (P536); legal/excise approval deferred (P533).

## Release decision

P531 is a developer-preview implementation with static evidence only. Do not enable production offline posting until the outstanding runtime, legal, finance and security gates pass.
