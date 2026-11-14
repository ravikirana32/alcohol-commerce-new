# P566 Release Notes

- Added per-source-line idempotency key and SHA-256 request fingerprint to stock movements.
- Added organisation/outlet-scoped partial unique index; existing rows remain compatible with NULL keys.
- Added append-once service helper with safe identical replay and payload conflict detection.
- Added unit tests and static verifier.
- No existing posting workflow is represented as globally idempotent until it adopts the helper.
