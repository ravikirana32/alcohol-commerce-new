# P533 — Excise & Regulatory Rules Engine

**Release:** `0.533.0-dev`  
**Status:** PARTIAL / developer preview; not production approved  
**Baseline:** P532 cumulative

## Regulatory sources reviewed

The initial Karnataka policy pack is based on the following government references, but deliberately remains `DRAFT` until independent legal review:

1. Government of Karnataka, State Excise Department, Karnataka Gazette No. 822, FD 52 EFL 2025, dated 19 December 2025. The notification distinguishes CL(2-A) off-shop and CL(9-A) bar licence profiles; the CL(2-A) conditions prohibit consumption on the licensed premises and CL(9-A) conditions describe service with meals/eatables. Official PDF: https://stateexcise.karnataka.gov.in/uploads/media_to_upload1766151388.pdf
2. Karnataka Excise (General Conditions of Licences) Rules, 1967, including Rule 10 customer restrictions and Rule 10-A dry-day restrictions. Government of Karnataka Legislature reference copy: https://kla.kar.nic.in/council/Replies/unstarred/21082025/usq1159%2821082025%29.pdf

The seeded pack records the 21-year age threshold, intoxication/restricted-customer checks, CL2A off-shop restriction, CL9A meals/eatables condition and Gandhi Jayanti dry-day rule. Licence-specific opening hours are not hard-coded; they must be transcribed from the actual licence and independently verified. District/election dry-day orders must be entered with their official order reference and source URL. No quantity caps or other rules are guessed.

## Delivered capabilities

- Effective-dated jurisdiction rule packs with source register, version, status and immutable audit history.
- Seeded `KA-BASE-2025-12` Karnataka pack in `DRAFT`; no rule pack is auto-activated.
- Rule-pack lifecycle: draft editing, submission, independent review, and activation by a third distinct platform administrator.
- Licence-specific weekly operating hours, submitted by an organisation and independently verified by platform administration.
- Official dry-day order register with source URL, district scope, review and audit history.
- Immutable compliance decisions with request hash, rule pack, licence, reason codes and evidence snapshot.
- Asia/Kolkata local date/time evaluation.
- Denial when no active approved pack, verified licence, supported licence class, verified operating hours, customer attestations or dry-day clearance exists.
- Retail and bar online checkout gates.
- P528 offline authoritative validation checks excise requirements. P530/P531 posting is fail-closed for offline alcohol transactions because P525 enrolment has no cryptographic secure-clock attestation; P538 must supply verifiable device-time evidence before offline alcohol posting can be enabled.
- POS operator attestations: age proof checked and customer at least 21; customer not intoxicated; no other restricted category; bar meal/eatables supplied. Only booleans are stored; no DOB or identity document number is collected.
- Compliance administration UI under **Compliance**.

## API endpoints

- `GET /api/v1/excise/rule-packs`
- `POST /api/v1/excise/rule-packs`
- `GET /api/v1/excise/rule-packs/:packId/rules`
- `POST /api/v1/excise/rule-packs/:packId/rules`
- `POST /api/v1/excise/rule-packs/:packId/submit`
- `POST /api/v1/excise/rule-packs/:packId/review`
- `POST /api/v1/excise/rule-packs/:packId/activate`
- `GET /api/v1/outlets/:outletId/excise/conditions`
- `POST /api/v1/outlets/:outletId/licences/:licenceId/excise-conditions`
- `POST /api/v1/excise/licence-conditions/:conditionId/review`
- `POST /api/v1/excise/dry-day-orders`
- `GET /api/v1/excise/dry-day-orders`
- `POST /api/v1/excise/dry-day-orders/:orderId/review`
- `POST /api/v1/excise/evaluate`
- `GET /api/v1/excise/decisions`

## Enforcement details

- Licence class normalisation accepts `CL(2-A)`, `CL-2A` and equivalent formatting as `CL2A`; `CL2` is also treated as off-shop. `CL(9-A)` / `CL-9A` and `CL9` are treated as bar profiles.
- Retail requires a verified current off-shop class and the `RETAIL_SALE` activity; on-premises consumption attestation denies.
- Bar requires a verified current bar class and the `BAR_SERVICE` activity; meal/eatables attestation is mandatory.
- Age verification is a cashier attestation after checking acceptable proof; the application intentionally does not store birth date or identity-document number.
- The engine denies unsupported jurisdiction/licence profiles and missing verified operating hours.
- Dry-day decisions use the local transaction date, Gandhi Jayanti and approved district/state orders.
- Online and offline decisions are linked to sale/ticket records. Denied decisions are retained for audit.

## Important limitations and release gates

- Only Karnataka (`KA`) has a seeded rule pack. Other states remain blocked until their current statutes, licence classes, conditions and dry-day orders are reviewed and a jurisdiction pack is created/activated.
- The Karnataka pack is still DRAFT. Until a qualified legal reviewer and independent platform administrators approve/activate it, regulated checkout intentionally fails closed.
- Customer-age verification is an operator attestation, not an electronic identity verification integration.
- Offline alcohol posting is currently blocked with `OFFLINE_EXCISE_TIME_TRUST_UNAVAILABLE`; a client timestamp alone cannot prove statutory trading hours or dry-day compliance. P538 must implement cryptographically verifiable device-time attestation. The API also requires compliance attestations and an offset-aware occurrence timestamp.
- PostgreSQL migration execution, API integration, concurrency, IDOR, browser E2E and legal sign-off have not been run/obtained.
- This engine does not replace the Excise Department's licence, tax or legal interpretation.
