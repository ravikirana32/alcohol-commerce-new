# P533 Test Report

## Static checks passed

- P533 static acceptance: 24/24.
- P530 posting regression verifier: 22/22.
- P531 bar measure regression verifier: 31/31.
- P528 authoritative regression verifier: 16/16 (includes P533 excise check).
- P529 approval regression verifier: 16/16.
- P532 recovery regression verifier: 16/16.
- TypeScript syntax transpilation: 248 files, 0 syntax diagnostics.
- Migration static ordering: 232 ordered SQL files passed.
- Migration preflight: duplicate numeric prefixes 150, 151, 176 and 223 remain inherited warnings.

## Blocked / not run

- Vitest: blocked; `vitest` executable/dependencies are not installed.
- Semantic TypeScript typecheck: blocked by missing Express, Zod, pg and Node type packages/declarations.
- PostgreSQL migration 232 execution from clean and supported prior baselines.
- API integration for rule-pack lifecycle, licence conditions, dry-day orders and all checkout gates.
- Concurrent rule-pack activation, licence-hours review, dry-day review and checkout-vs-dry-day races.
- Failure injection/rollback, tenant IDOR and permission matrix tests.
- Browser E2E for operator attestations and Compliance administration.
- Offline alcohol posting is intentionally blocked until P538 secure-clock attestation; P525 device enrolment has no cryptographic clock proof.
- Legal review/approval by qualified Karnataka excise counsel/authority.

## Critical runtime behaviour

The Karnataka seed pack is DRAFT, and there is no active pack by default. The online and offline checkout paths therefore deny sales until a legal pack and outlet licence-hours schedule have completed independent review/activation. This is intentional fail-closed behaviour, not a successful live checkout test.

## Release conclusion

P533 is a code-delivered developer preview. Static checks are not proof of runtime correctness or legal compliance. Do not enable production alcohol sales until database, API, concurrency, security, browser, UAT and legal approval gates pass.
