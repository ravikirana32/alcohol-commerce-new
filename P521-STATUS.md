# P521 Status

**Release:** 0.523.0-dev  
**Overall:** PARTIAL — developer preview; not production approved.

| Area | Status |
|---|---|
| Chart of accounts schema/API | Implemented; static verified |
| Journal header/line schema | Implemented; static verified |
| Transactional balanced journal posting API | Implemented; static verified |
| Deferred DB balance trigger | Implemented; not runtime-tested |
| Trial balance API | Implemented; static verified |
| Finance permissions | Seeded in migration; not runtime-tested |
| Automatic source-system postings | Missing |
| GST ledgers/reports | Missing |
| Finance UI/general ledger | Missing |
| P&L/balance sheet/cash flow | Missing |
| Period close/reversal approval | Missing |
| PostgreSQL execution/API E2E/browser E2E | Not run |
| Production approval | Not approved |

## Verification
- P521 static acceptance: run `npm run verify:p521`.
- Cumulative static verifiers and migration validation: run using the P521 runbook.
- Dependency-backed typecheck/build and runtime tests: outstanding.

See `P513-ONWARD-GAP-REGISTER.md` for all open and partially developed items from P513 onward.
