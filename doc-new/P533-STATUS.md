# P533 Status

- Release: `0.533.0-dev`
- Delivery: PARTIAL / developer preview; not production approved.
- Implemented: effective-dated Karnataka rule pack, licence-class mapping, 21+ operator attestation, restricted-customer checks, CL2A off-shop/CL9A bar conditions, verified licence hours, Gandhi Jayanti and official dry-day orders, immutable decisions, rule-pack lifecycle and compliance UI.
- Enforcement: online retail/bar gates and P528 authoritative offline checks. P530/P531 offline alcohol posting is intentionally blocked until P538 supplies cryptographic secure-clock attestation.
- Safety: Karnataka pack remains DRAFT; no sales allowed until legal review, independent review and third-person activation. Other state jurisdictions fail closed.
- P533 static acceptance: 24/24 PASS.
- P530 regression: 22/22; P531: 31/31; P528: 16/16; P529: 16/16; P532: 16/16 static checks pass.
- TypeScript syntax transpilation: 248 files, 0 syntax diagnostics.
- SQL migration static ordering: 232 files pass.
- PostgreSQL runtime, API integration, concurrency, IDOR, browser E2E and legal sign-off: not run / not obtained.
- Vitest unavailable (`vitest: not found`); semantic typecheck blocked by missing Express/Zod/pg/Node dependencies and declarations.
