# P534 Runbook — Final Candidate

## Preconditions

- Use a disposable PostgreSQL instance first; take a verified backup before any upgrade.
- Install the exact workspace dependencies using the repository lockfile in CI/staging.
- Never seed statutory tax rates from assumptions. Obtain official Gazette/notification evidence and CA/legal review.
- Keep jurisdiction rule packs in DRAFT until source evidence and independent approvals are complete.

## Migration validation

1. Apply migrations 001–236 to an empty disposable PostgreSQL database.
2. Separately restore/prepare a supported P533 database and apply 233–236.
3. Verify constraints, foreign keys, append-only triggers, effective-period overlap triggers and advisory-lock serialization.
4. Exercise rollback/reapply in a disposable environment and record database/server versions and logs.

## Application validation

1. Install dependencies from lockfile.
2. Run API/web semantic typechecks and Vitest.
3. Run P534 static, retail checkout, bar ticket/refund and P533 excise regressions.
4. Run API integration and Playwright E2E for rule-pack lifecycle, product profiles, outlet prices, retail checkout and PEG/BOTTLE/PACKAGED bar checkout.
5. Run tenant IDOR, role/permission, concurrent activation/price approval/checkout, failure-injection and load tests.
6. Reconcile multi-line invoices, tender settlement, tax payable and journals with finance-approved fixtures.

## Operational restrictions

- No production tax pack activation without official source evidence and independent review.
- Unsupported/interstate jurisdiction must fail closed.
- Missing active pack, verified profile or approved effective price must fail closed.
- Do not treat P534 quote/snapshot as settlement or accounting posting evidence.
- Offline alcohol posting remains disabled pending P538 secure-time/device attestation and all legal/security/finance gates.
