# P555 Release Notes

- Adds real-login/JWT/session-backed API authorization test harness.
- Exercises DB-derived membership and permission behavior through deployed endpoints.
- Verifies permission denial and server-side session revocation.
- Route cases are restricted to GET/HEAD to avoid unintended business mutations.
- No schema, grant, runtime policy or production behavior changes.
- Developer preview only; runtime acceptance and production security gates remain open.
