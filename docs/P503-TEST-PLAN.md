# P503 test plan

1. Apply migrations 001–215 to a new disposable PostgreSQL database.
2. Restore a P502 database snapshot and apply only migration 215.
3. Verify migration checksum registry rejects edits to previously applied migrations.
4. Verify cashier without `bar:quarantine:manage` receives 403.
5. Verify manager can list only their organisation's quarantine records.
6. Verify unknown restoration ID returns 404.
7. Verify pending record can be disposed once; repeat request returns 409.
8. Verify compliance disposition without reference returns 400.
9. Verify compliance disposition with reference records actor, reason and timestamp.
10. Verify two concurrent disposition requests result in exactly one successful update.
11. Verify no disposition mutates `open_bottles.remaining_ml`, `stock_balances` or saleable inventory.
12. Verify audit event contains `saleableStockChanged=false`.
13. Run browser tests at desktop/tablet/mobile widths, including network failure and refresh.
14. Run API/web typecheck, production build, all Vitest suites and E2E tests.
