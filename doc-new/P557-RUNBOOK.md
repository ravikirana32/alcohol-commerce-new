# P557 Runbook

## Generate route inventory

```bash
npm run audit:p557:routes
```

Outputs:
- `P557-TENANT-ROUTE-COVERAGE.md`
- `../reports/P557-TENANT-ROUTE-COVERAGE.json`

## Static regression

```bash
npm run verify:p557:static
npm run check:syntax
npm run verify:migrations
```

## Runtime boundary tests

Use a disposable environment and follow `P556-RUNBOOK.md` to configure `API_BASE_URL`, `P555_ROLE_CREDENTIALS_JSON`, and `P556_TENANT_CASES_JSON`. Include only known fixture IDs and actual API paths. The P556 harness intentionally restricts requests to GET/HEAD and expects 403/404 for negative boundary cases. Never point destructive test cases at production.

## Manual source review

For each route with a path identifier, trace handler -> service -> repository -> SQL and verify organisation and outlet predicates are derived from the authenticated principal, not trusted from request input. Verify foreign resources return a non-disclosing 404 or policy-approved 403. Add authenticated positive and negative tests for each resource family before closing the gap.
