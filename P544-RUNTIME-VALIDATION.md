# P544 — Runtime Validation

## Smoke command

```bash
API_BASE_URL=https://api.example.com WEB_BASE_URL=https://pos.example.com npm run smoke:p544
```

The smoke script checks API liveness, API readiness (including database connectivity), API metadata/version, and the web root. It uses bounded request timeouts and reports only endpoint labels/status codes. Run it against a deployed test/staging environment after migration and service startup.

## Current execution evidence
- The smoke script was executed in the current workspace against its default local endpoints.
- API probes returned HTTP 404 and the web root was unreachable; this is a failed smoke run, not a pass. The responding API endpoint may be an unrelated service or wrong base URL; verify the target host/port before interpreting it as an application defect.
- Docker CLI/Compose is unavailable in this execution environment, so image build, container health, PostgreSQL readiness and migration execution were not performed.
- `node scripts/verify-p544.mjs`: deterministic configuration checks pass after the phase documentation is present.
- `node scripts/check-typescript-syntax.mjs`: 263 files, 0 syntax diagnostics.
- `python3 scripts/verify-migrations.py`: 242 SQL migration files pass static ordering/content checks only.
- `.env.example` passes the development-mode environment preflight. This does not validate production secrets or connectivity.

## Required next evidence
Run clean dependency installation, API/web builds, semantic typechecks, Docker Compose config/build/up, PostgreSQL clean install and upgrade, and smoke tests against the actual API/web deployment. Preserve logs and redact secrets.
