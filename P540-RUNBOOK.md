# P540 Developer Preview Runbook

1. Use the cumulative ZIP and extract the `POS-P540-work` directory.
2. Configure the existing application environment and PostgreSQL connection using the repository's normal runbook; do not commit provider secrets.
3. Provision any referenced credential environment variables through deployment secret management. The database stores only the environment variable name.
4. Run `npm install` in the repository root.
5. Run `npm run db:migrate --workspace @acp/api` to apply migration 241 after reviewing the migration plan.
6. Run `node scripts/verify-p540-integrations.mjs`, `node scripts/check-typescript-syntax.mjs` and `python3 scripts/verify-migrations.py`.
7. Start API/web using the existing root scripts.
8. Authenticate as an organisation user with `integration:read` or `integration:manage` permission.

Outbound delivery is disabled by design. Do not enable network dispatch or connect production provider credentials until provider-specific adapters, SSRF-safe egress, signing, retries, secret rotation, sandbox certification and security review are completed.
