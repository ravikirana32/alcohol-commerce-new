# P571 Release Notes — 0.571.0-dev

- Adds signed adjustment direction to stock movement rows.
- Requires direction for newly inserted adjustment movements using a database trigger and service validation.
- Adds immutable organisation/outlet opening balance snapshots and product lines.
- Reconciliation now includes opening balances and signed post-snapshot adjustments.
- Legacy adjustments with unknown sign remain excluded from arithmetic and surfaced as exceptions.
- Adds one-time opening snapshot API.
- No automatic stock balance correction is performed.
- Runtime migration, concurrency and security acceptance remain outstanding; release is not production-approved.
