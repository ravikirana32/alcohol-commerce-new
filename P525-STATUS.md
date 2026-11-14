# P525 Status

**Release:** 0.525.0-dev — PARTIAL / developer preview

| Area | Status | Evidence / limitation |
|---|---|---|
| Device enrolment and revocation API | Implemented in source | Static verifier; live API test pending |
| Bounded sync batch intake | Implemented in source | Static verifier; live API test pending |
| Idempotent batch replay | Implemented in source | Payload hash and replay response; PostgreSQL race test pending |
| Per-device event/sequence dedupe | Implemented in source | Database unique constraints; migration not executed here |
| Conflict and audit ledger | Implemented in source | Static source checks; persistence test pending |
| Financial posting | Disabled | No downstream sale/payment/stock/journal posting |
| Device cryptographic attestation | Missing | Device ID is not hardware proof |
| Client ack cursor/retry/dead-letter | Missing | Future phase |
| Review UI and maker-checker | Missing | Manual workflow not provided |
| PostgreSQL/API/browser/security E2E | Not run | Requires provisioned environment and dependencies |

## Release decision

Do not use P525 as production offline checkout. Continue only after database migration and API integration tests pass, cross-tenant and concurrent replay tests pass, legal eligibility is verified, and an approved reconciliation workflow exists.
