# P538 — POS Device Trust & Attestation Foundation

**Release:** 0.538.0-dev  
**Baseline:** P537 cumulative 0.537.0-dev  
**Status:** Backend developer-preview implementation; production acceptance not established.

## Delivered

- Migration 240 adds organisation-scoped POS device registry and expiring, single-use device challenge records.
- Device enrollment stores an SPKI PEM public key and SHA-256 fingerprint; duplicate active key enrollment is idempotent within the organisation.
- Device challenge endpoint issues a cryptographically random 256-bit nonce with a two-minute expiry and consumes prior outstanding challenges.
- Device attestation verifies a client signature against the enrolled public key (RSA-SHA256 or ECDSA-SHA256); invalid attempts consume the challenge to prevent retry/replay.
- Device status transitions to TRUSTED only after signature verification; revocation consumes pending challenges and cannot be reversed using the same key.
- Device list, enrollment, challenge, attestation and revocation routes are authenticated, organisation-scoped and permission-gated.
- API version advanced to 0.538.0-dev.

## API

- `GET /api/v1/devices`
- `POST /api/v1/devices`
- `POST /api/v1/devices/:deviceId/challenge`
- `POST /api/v1/devices/:deviceId/attest`
- `POST /api/v1/devices/:deviceId/revoke`

## Security and operational boundary

This is cryptographic proof of possession of an enrolled private key, not platform-backed hardware attestation (Apple App Attest, Android Play Integrity, TPM or Secure Enclave validation). Trusted status alone does not establish secure wall-clock time, tamper-resistant storage, app integrity, geolocation, legal offline-sales eligibility or outlet licensing. P538 does not enable offline alcohol posting, bypass P533 excise controls, or mark offline tender as settled. Secure-time and hardware-backed attestation integrations remain open.

## Verification performed

- P538 static invariants: 14/14 PASS.
- TypeScript syntax transpilation: 259 files, 0 diagnostics.
- Ordered SQL migration static validation: 240 files PASS.
- PostgreSQL execution, API integration, cryptographic runtime fixtures, tenant IDOR, concurrency, semantic typecheck, Vitest and browser/mobile tests: NOT RUN.

## Open gaps

1. Add real RSA and ECDSA signing/verification integration tests, expired challenge and replay tests.
2. Add Apple App Attest, Android Play Integrity and hardware-backed key validation.
3. Bind device trust to secure-time attestation and offline event validation; no trusted clock is implemented here.
4. Add device administration UI, mobile enrollment UX, QR/deep-link pairing and recovery workflow.
5. Add device posture, app version/minimum version policy, jailbreak/root detection and remote wipe/key rotation policy.
6. Execute migration upgrade/rollback, multi-tenant IDOR, permission, race and revocation-under-load tests on PostgreSQL.
7. Offline regulated alcohol posting remains disabled pending legal, excise, secure-time, finance and operational gates.
