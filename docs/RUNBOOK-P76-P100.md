# P76–P100 runbook

This batch contains phase contracts and disabled capability registry entries; it does not deliver complete production modules.

1. Back up PostgreSQL and verify restore readiness.
2. Review migrations before applying them to a non-disposable database.
3. Apply migrations in numeric order after P75 using the repository migration runner.
4. Confirm newly registered capability entries remain `enabled = false`.
5. Run local build, API, UI, integration, offline, security and E2E tests before activation.
6. Record qualified legal/compliance approval evidence for every jurisdiction-specific capability.

Safety defaults: AI remains disabled; consumer-facing alcohol discovery/marketing remains disabled unless legally approved; regulatory reports require human authorisation; licence permissions must never be inferred from software configuration.

No migrations, builds, runtime, security or E2E tests were executed as part of ZIP generation.
