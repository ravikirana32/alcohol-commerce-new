# P509 Offline Operations Safety
Offline transaction sync is intentionally disabled in the local Docker profile until end-to-end and compliance acceptance tests pass.

## Required invariants before enabling
1. Client-generated operation UUID and tenant/outlet/device binding.
2. Server-side idempotency ledger; duplicate operation replays return original outcome.
3. Server validates signed-in user, outlet scope, product/price/tax and licence eligibility at sync time.
4. Conflict states are explicit; never silently overwrite stock, cash, shift, refund or bottle-volume ledgers.
5. Financial and inventory writes are atomic and auditable.
6. Device clock is informational only; server timestamp is authoritative.
7. Expired sessions, revoked devices and disabled outlets reject queued writes.
8. Reconciliation screen supports manager review and immutable resolution record.
9. Back-pressure and bounded queue; no unlimited retry storm.
10. Offline availability is restricted to approved transaction classes and outlet policy.

## Manual acceptance
Test airplane-mode sales, app restart with queued events, duplicate sync, network loss mid-commit, concurrent online/offline stock changes, revoked user/device and clock skew. Keep `OFFLINE_SYNC_ENABLED=false` until all pass.
