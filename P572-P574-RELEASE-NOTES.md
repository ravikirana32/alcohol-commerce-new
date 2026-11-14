# P572–P574 Release Notes

Version: `0.574.0-dev`

- Serializes stock movement inserts against opening-balance snapshot capture using transaction advisory locks.
- Records reconciliation ledger cutoff and opening snapshot reference.
- Adds idempotent maker-checker stock variance correction requests.
- Approval writes one signed stock adjustment and balance update in one transaction.
- Adds P572/P573/P574 static verifiers and PostgreSQL catalog acceptance script.
- No production release approval; runtime and security acceptance remain outstanding.
