# P512 Go-Live Gates — Alcohol Commerce Platform

Status: NOT APPROVED FOR PRODUCTION OR LIVE ALCOHOL TRANSACTIONS.

Every gate requires named owner, evidence, date and explicit sign-off. Do not convert a checklist into approval merely by running software tests.

## Technical gates
- [ ] Clean PostgreSQL install and upgrade path pass on supported PostgreSQL version.
- [ ] API and web typecheck/build pass in CI.
- [ ] API unit and integration tests pass.
- [ ] Playwright critical journeys pass on supported browsers.
- [ ] Concurrency/idempotency/refund invariants pass.
- [ ] Tenant isolation and permission matrix verified.
- [ ] Offline sync remains disabled unless its full acceptance suite passes.
- [ ] Backup restore and disaster recovery drill pass.
- [ ] Performance/load and soak testing meet agreed SLOs.
- [ ] Monitoring, alerting and incident response are operational.

## Security gates
- [ ] Dependency/SBOM and secret scans reviewed.
- [ ] SAST/DAST completed.
- [ ] Independent penetration test completed.
- [ ] Critical/high findings remediated or formally risk-accepted.
- [ ] TLS, key rotation, least privilege and audit retention verified.

## Legal and business gates
- [ ] Karnataka excise counsel/regulatory review completed for the exact operating model and outlet licences.
- [ ] GST, invoicing, data protection, payment and record-retention obligations reviewed by qualified advisers.
- [ ] Each pilot outlet's licence and permitted activities verified by authorised personnel.
- [ ] No prohibited online alcohol sale/delivery or consumer transaction flow enabled.
- [ ] Staff training, SOPs, incident contacts and support coverage ready.

## Pilot gates
- [ ] Written authorisation from outlet owner and required authorities.
- [ ] Pilot scope, duration, rollback and data handling approved.
- [ ] UAT signed by cashier, bartender, manager and finance roles.
- [ ] Reconciliation, refunds, stock and shift close verified daily.
- [ ] Pilot exit criteria met and production go/no-go recorded.

Legal requirements vary by activity and licence. This checklist is not legal advice or a statement that any particular activity is permitted in Karnataka.
