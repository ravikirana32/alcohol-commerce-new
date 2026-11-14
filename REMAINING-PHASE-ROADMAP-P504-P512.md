# Remaining required phases — P504 to P512

The objective is to reach a repeatable **95% engineering-workable release candidate** before external legal/security/pilot gates. “95%” is a target, not a claim of current readiness. No software phase can self-certify legal compliance or production safety.

| Phase | Focus | Exit evidence |
|---|---|---|
| P504 | Docker one-command local stack, migration-gated startup, health checks, operator quickstart | Compose config validated on a machine with Docker; clean startup and shutdown demonstrated |
| P505 | PostgreSQL integration foundation | Disposable DB tests; clean install and P502/P503 upgrade; migration rollback/forward recovery and checksum tests |
| P506 | API integration and concurrency | Auth/bootstrap, tenant/outlet scope, retail/bar checkout, refunds, shifts, inventory and quarantine tested against PostgreSQL; duplicate and concurrent requests covered |
| P507 | Browser E2E and end-to-end journeys | Playwright coverage for login, outlet setup, retail sale, split tender, bar peg/bottle sale, refund, shift close, stock receive/adjust, quarantine; screenshots/traces on failure |
| P508 | Security and tenancy hardening | RLS or equivalent enforced tenant isolation, route permission audit, secure cookie/CSRF decision, rate limits, secrets handling, dependency and SAST/DAST review; independent penetration test findings resolved |
| P509 | Offline/PWA and resilience | Offline queue, conflict resolution, idempotent sync, device recovery, network interruption tests; enable only after security and data integrity pass |
| P510 | Procurement, inventory and finance completion | Supplier/PO/GRN, SKU-level stock ledger, stocktake, wastage/breakage, tax/discount/rounding, cash/UPI/card reconciliation, refund accounting and export reports |
| P511 | Operations, integrations and non-functional readiness | Audit/observability, alerts, backup+restore drill, retention, performance/load test, printer/KDS/hardware compatibility, deployment/rollback runbooks |
| P512 | Compliance evidence and controlled pilot | Karnataka excise/legal sign-off, licence/capability matrix verified by counsel, independent security clearance, authorised outlet pilot, incident/rollback drill, signed go/no-go |

## Cross-phase acceptance gates

- No phase is called complete based on static checks alone when runtime verification is required.
- Each release includes cumulative ZIP, migration inventory, known limitations, test results and SHA-256.
- AI remains disabled by default. Consumer discovery, payment-live and notification-live modes remain disabled until separately reviewed.
- Alcohol sales and outlet capabilities must be blocked unless the specific outlet licence and permitted capability have been verified through the approved legal/business process.
- Returned bar liquid remains quarantined; it must not silently re-enter saleable bottle volume.
- Retail refund restock is based on SKU/quantity allocations, not monetary proration.

## Manual gates owned by the operator / specialists

1. Install and run Docker Desktop/Engine; provide a machine with enough disk/RAM and internet for first image/dependency download.
2. Supply organisation, outlet, licence evidence and an authorised test operator; do not use real sales until approvals are complete.
3. Engage Karnataka excise counsel/regulatory specialists to approve permitted workflows, records, reporting and retention.
4. Commission an independent security assessment and resolve all critical/high findings.
5. Provide an authorised pilot outlet, hardware/printers/network and staff for supervised UAT; approve rollback and incident contacts.
6. Configure production secrets, backups, monitoring, domain/TLS, email/SMS/payment providers only after the relevant security/legal gates.
