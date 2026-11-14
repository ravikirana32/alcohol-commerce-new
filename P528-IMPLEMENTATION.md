# P528 — Authoritative Offline Business Validation

**Version:** 0.528.0-dev  
**Status:** PARTIAL / developer preview  
**Baseline:** P527 cumulative source

## Delivered

- Added migration `apps/api/src/db/227_p528_authoritative_offline_checks.sql` and organisation-scoped immutable `offline_authoritative_checks` evidence.
- Added `POST /api/v1/offline/posting-intents/:intentId/authoritative-check` and `GET /api/v1/offline/authoritative-checks`.
- Checks supported transaction type, current organisation and outlet status/operating mode, verified current outlet licence activity (`RETAIL_SALE` or `BAR_SERVICE`), organisation-owned active products, current outlet-specific prices, retail stock balances, and payment allocation totals. Unsupported event types fail closed.
- A failed check changes the intent to `HELD`. A successful check leaves it `READY_FOR_POST`.
- Added audit event `AUTHORITATIVE_CHECK` and a review action in `OfflineReconciliationWorkspace`.
- Added role permissions for authoritative check and read operations.

## Safety boundary

P528 still does **not** create retail sales, bar tickets, payment captures, stock movements, tax entries, accounting journals or excise records. Passing validation is not authorisation to sell alcohol or proof of legal compliance. Offline financial posting remains disabled.

Bar stock validation deliberately fails closed: measure-aware bottle/peg depletion is not yet implemented, so bar checkout intents cannot pass all authoritative checks. Licence capability strings must be confirmed against the approved state/jurisdiction rule catalogue before production. Tax/GST, age/transaction eligibility, price/tax snapshots, payment gateway/cash evidence, event freshness, device signatures/attestation, and live legal rule versioning remain incomplete.

## API

- `POST /api/v1/offline/posting-intents/:intentId/authoritative-check` — body `{ "notes": "..." }`; immutable one-check-per-intent evidence.
- `GET /api/v1/offline/authoritative-checks` — latest 250 checks for the authenticated organisation.

## Verification

- P528 static acceptance: 15/15.
- TypeScript syntax transpilation: 236 files, 0 diagnostics.
- SQL migration static validation: 227 ordered files passed.
- Runtime PostgreSQL/API/browser/security/concurrency tests were not run. Full dependency-backed typecheck/build was not established.

## Remaining exit gates

1. Validate licence capability codes against approved jurisdictional rules and test expired/suspended licences.
2. Implement tax/GST and age/transaction eligibility with versioned rule evidence.
3. Implement bar measure-aware bottle depletion and stock reservations.
4. Validate payment evidence with supported gateway/acquirer/cash reconciliation.
5. Add second maker-checker posting approval and an idempotent transactional posting worker/outbox.
6. Prove PostgreSQL concurrency, replay, rollback, IDOR, cross-org and browser E2E.
7. Obtain excise/legal, finance and security sign-off before enabling any posting.
