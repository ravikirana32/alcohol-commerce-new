# P20 production readiness checklist

A checkbox is not complete until evidence is attached and reviewed.

## Application and data
- [ ] TypeScript build and lint pass in clean CI.
- [ ] All migrations apply from empty database and from supported prior version.
- [ ] Restore tested from encrypted backup.
- [ ] Tenant and outlet isolation negative tests pass.
- [ ] Role/permission matrix reviewed and least privilege verified.
- [ ] Licence capability and expiry checks cover every regulated operation.
- [ ] Transaction concurrency, duplicate retries and payment callback tests pass.
- [ ] Peg volume, stock movements and financial ledger reconcile.
- [ ] Offline replay, conflict handling and device revocation tested.

## Security and privacy
- [ ] MFA, password reset, session rotation, throttling and lockout implemented.
- [ ] Secure cookie/BFF or equivalent hardened token storage deployed.
- [ ] CSRF, CORS, CSP, input validation and dependency scanning reviewed.
- [ ] Secrets stored in a secret manager; rotation tested.
- [ ] Data retention, deletion, consent and incident response documented.
- [ ] Independent security assessment completed.

## Operations
- [ ] Metrics, structured logs, traces and alert routing active.
- [ ] Backup schedule, RPO/RTO and restore drill approved.
- [ ] Capacity/load test and performance budgets met.
- [ ] CI/CD rollback and database migration strategy rehearsed.
- [ ] Support escalation, incident and outage runbooks tested.

## Legal and business
- [ ] Karnataka excise and all applicable local/state requirements reviewed by qualified counsel/consultant.
- [ ] Outlet licences and permitted activities verified by the relevant authority.
- [ ] Consumer discovery and brand/trade campaign content approved where applicable.
- [ ] Payment, tax, accounting and data protection obligations reviewed.
- [ ] Pilot outlets, training, acceptance criteria and sign-off documented.

**Release gate:** P20 is not a statement that the application is production-ready. Launch is blocked until every mandatory item has evidence and an accountable approver.
