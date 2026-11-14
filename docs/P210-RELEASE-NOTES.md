# P210 — Refunds, cash ledger and shift reconciliation

## Scope
Add controlled retail/bar refund records and explicit shift cash in/out movements to shift close calculations.

## Delivered
- Added partial retail refund ledger with manager/owner permission grants, reason capture, audit event and optional proportional stock return.
- Added bar refund ledger; peg/open-bottle ml is deliberately not restored automatically. Full ticket refund marks the ticket voided.
- Added shift cash-in/cash-out ledger with open-shift validation and event audit.
- Shift close expected cash now includes cash refunds and net cash movements.
- Shift opening now serializes on the outlet row and prevents multiple concurrent open shifts.

## Validation evidence
- ZIP integrity and source syntax checks are run for all phase archives.
- Migration ordering static check passes for the cumulative source tree.
- Refund/shift routes and migrations are source-reviewed only.

## Limitations
No end-to-end refund, cash drawer, payment-provider reversal, void/approval workflow, or DB transaction tests were run. Bar refunds do not restore peg ml. Hardware cash-drawer integration and legal/accounting sign-off remain outstanding.

**Release classification:** developer preview only. Do not use for live alcohol transactions until the release gates in `docs/SECURITY-AND-RELEASE-GATES.md` are completed.
