# P555 Runbook

1. Start a disposable PostgreSQL/API environment and apply migrations.
2. Enable demo seeding only in that disposable environment; configure `DEMO_SEED_ENABLED=true` and a strong `DEMO_SEED_PASSWORD` locally. Never use demo seeding in production.
3. Set `API_BASE_URL` to the local API base URL.
4. Set `P555_ROLE_CREDENTIALS_JSON` to a JSON object keyed by exact role codes, with email/password and optional organisationId. Keep this in an untracked local `.env` or shell secret store.
5. Set `P555_API_CASES_JSON` to actual protected read-only GET/HEAD API paths, each annotated with role, exact permission and expected status. Include both grants and denials.
6. Run `npm run verify:p555` for static checks.
7. Run `npm run test:authorization:p555:live` against the disposable environment only. The harness logs out the first role's test session as a revocation check.
8. Save console output as test evidence. Do not include credentials or tokens in logs/issues.

Example shell shape (replace placeholders; do not commit secrets):

```bash
export API_BASE_URL=http://127.0.0.1:8080
export P555_ROLE_CREDENTIALS_JSON='{"RETAIL_OWNER":{"email":"retail.owner@demo.acp.local","password":"<local-secret>","organisationId":"<test-org-uuid>"}}'
export P555_API_CASES_JSON='[{"role":"RETAIL_OWNER","permission":"catalogue:product:read","path":"/api/catalogue/products","method":"GET","expectedStatus":200}]'
npm run test:authorization:p555:live
```

The example endpoint/permission must be checked against the actual route middleware in the target build before use. Do not infer full coverage from a partial case list. Never point this harness at production.
