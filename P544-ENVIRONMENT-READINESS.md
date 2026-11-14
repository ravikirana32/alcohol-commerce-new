# P544 — Environment Readiness

## Scope
P544 adds a fail-closed environment preflight and deterministic configuration tests. It validates required API configuration, PostgreSQL URL scheme/host, JWT strength, web-origin syntax, port ranges, production HTTPS, placeholder secrets, secure-cookie setting, and production restrictions on live payment/offline-sync flags.

## Commands

```bash
cp .env.example .env
# Edit .env locally; use unique secrets and a reachable PostgreSQL URL.
npm run verify:p544
node scripts/verify-p544-environment.mjs --env-file=.env
```

The preflight prints variable names and issue codes only; it never prints secret values. Do not commit `.env` or paste secrets into support logs. `.env.example` is a development template, not a production configuration.

## Docker environment
`docker-compose.yml` binds published ports to loopback by default, waits for PostgreSQL health, runs migrations as a one-shot dependency, waits for successful migration completion before API startup, and checks API readiness before starting the web service. These are configuration observations, not evidence that Docker images build or containers start successfully.

## Production requirements
Use managed secret injection, TLS termination, production-grade PostgreSQL/Redis, restricted network access, secure cookies, a reviewed CORS origin allowlist, backups and restore drills. Remove/rotate the one-time bootstrap secret after initial platform setup. Keep live payment capture, offline alcohol posting and provider dispatch disabled until their separate release gates pass.
