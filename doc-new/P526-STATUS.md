# P526 Status

**Release:** PARTIAL — developer preview (`0.526.0-dev`)

| Area | Status | Evidence / limitation |
|---|---|---|
| Batch submitter attribution | Implemented | P525 intake persists submitting user; P526 backfills from batch audit |
| Review queue API | Implemented | Org-scoped status/batch filters; runtime not executed |
| Maker-checker | Implemented in source | Submitter cannot review own batch; runtime role tests pending |
| Decision reason and audit | Implemented in source | Transactional event update and audit insert |
| Conflict handling | Partial | Conflicts surfaced; no automated resolution |
| Review UI | Implemented in source | Authenticated workspace; browser E2E pending |
| Financial/stock posting | Disabled | `APPROVED_NO_POST` only |
| PostgreSQL runtime | Not run | Environment did not provide verified database execution |
| API/browser/security E2E | Not run | Must be completed before production |

## Required acceptance gates

- Apply migration to disposable PostgreSQL and production-like backup.
- Test submitter self-review denial, independent reviewer approval/rejection, wrong-org access, missing permission and repeated decisions.
- Race two reviewers on the same event and confirm exactly one decision is committed.
- Verify audit immutability/retention and reconcile batch status with event states.
- Confirm no event approval causes financial, inventory or accounting side effects.
