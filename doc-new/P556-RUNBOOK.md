# P556 Runbook

## Static verification
```bash
npm run verify:p556
```

## Unit tests (requires installed workspace dependencies)
```bash
npm run test:tenant:p556
```

## Live tenant/outlet negative API matrix
Use a disposable environment with seeded role users and known fixture IDs. Set:
- `API_BASE_URL` — API base URL.
- `P555_ROLE_CREDENTIALS_JSON` — JSON object keyed by role, each with `email`, `password`, and optional `organisationId`.
- `P556_TENANT_CASES_JSON` — JSON array of cases, e.g.:
```json
[
  {
    "role": "retail.manager",
    "boundary": "cross-organisation",
    "actorOrganisationId": "<actor-org-id>",
    "resourceOrganisationId": "<other-org-id>",
    "method": "GET",
    "path": "/api/<resource-route>/<foreign-resource-id>",
    "expectedStatus": 404
  },
  {
    "role": "outlet.manager",
    "boundary": "cross-outlet",
    "actorOutletId": "<actor-outlet-id>",
    "resourceOutletId": "<other-outlet-id>",
    "method": "GET",
    "path": "/api/<outlet-resource-route>/<foreign-resource-id>",
    "expectedStatus": 403
  }
]
```
Then run:
```bash
npm run test:tenant:p556:live
```

Only GET/HEAD are permitted. Replace placeholders with real disposable fixture values and real read-only API paths. The harness accepts 403 or 404 only when explicitly configured. It will not create or mutate fixtures.

## Safety
Never use production credentials or production data. Do not interpret a successful harness run as proof of all-route tenant isolation; add cases for each tenant-bearing route and nested resource family.
