# P210 Implementation Status

- Phase: P210
- Status: source changes delivered; developer preview
- Scope: Refunds, cash ledger and shift reconciliation
- Runtime/database verification: not completed in this environment
- Production readiness: not certified

- Added partial retail refund ledger with manager/owner permission grants, reason capture, audit event and optional proportional stock return.
- Added bar refund ledger; peg/open-bottle ml is deliberately not restored automatically. Full ticket refund marks the ticket voided.
- Added shift cash-in/cash-out ledger with open-shift validation and event audit.
- Shift close expected cash now includes cash refunds and net cash movements.
- Shift opening now serializes on the outlet row and prevents multiple concurrent open shifts.
