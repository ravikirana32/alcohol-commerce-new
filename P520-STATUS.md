# P520 Status

**Release:** 0.520.0-dev  
**Overall:** PARTIAL — developer preview; not production approved.

| Area | Status |
|---|---|
| Reconciliation batch schema | Implemented |
| JSON statement import API | Implemented |
| Duplicate provider transaction detection | Implemented |
| Exact payment matching (retail/bar) | Implemented |
| Ambiguous match exception handling | Implemented |
| Batch detail API | Implemented |
| CSV/XLSX/provider file import UI | Missing |
| Manual exception resolution and close | Missing |
| MDR/fees, chargebacks, payout-to-bank matching | Missing |
| Live gateway capture/refund | Disabled / not implemented |
| PostgreSQL runtime migration | Not tested |
| API integration and browser E2E | Not tested |

## Verification

- P520 static acceptance: 12/12.
- TypeScript syntax transpilation: 227 files, 0 diagnostics.
- Ordered migration static validation: 221 files.
- P517/P518/P519 verifiers: passed.
- Full dependency-backed typecheck/build and runtime tests: not run.
