# P568 Status

- Version: `0.568.0-dev`
- Scope: complete request-level stock movement idempotency for manual receipt, manual adjustment, open-bottle opening and goods receipt.
- Static verification: PASS (10/10 P568; 10/10 P567; 10/10 P566; 11/11 P565; 14/14 P564).
- TypeScript syntax: PASS (274 files, 0 diagnostics).
- Migration static validation: PASS (244 files).
- Vitest / semantic typecheck / PostgreSQL / concurrency / browser E2E: BLOCKED or NOT RUN; see `P568-TEST-REPORT.md`.
- Production: NO-GO.
