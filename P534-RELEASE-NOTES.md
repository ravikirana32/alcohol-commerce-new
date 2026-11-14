# P534 Release Notes — Final Candidate

**Version:** 0.534.0-dev  
**Baseline:** P533 cumulative

## Included

- Effective-dated tax rule packs and component configuration.
- Product tax profile verification and outlet price approval lifecycle.
- Server-side tax quote service and immutable calculation evidence.
- Retail and bar checkout integration with no legacy tax-rate fallback.
- BAR PEG/BOTTLE/PACKAGED pricing and PEG volume validation.
- Jurisdiction matching and effective-period overlap guards.
- Tax & Pricing administration workspace and updated verification scripts.

## Verification

P534 static 36/36, retail 17/17, bar 9/9, TypeScript syntax 253 files/0 diagnostics, migration static validation 236 files and archive checksum verification passed.

## Known limitations

PostgreSQL runtime/rollback, Vitest, semantic typecheck, API/browser E2E, IDOR/concurrency/load tests, finance sign-off, official statutory rate verification, interstate logic and tax-to-settlement/journal reconciliation remain outstanding. This release is developer preview only; no statutory rates are seeded or activated.
