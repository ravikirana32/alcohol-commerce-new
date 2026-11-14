# P585 Production Deployment Checklist

## Before change window
- [ ] Release candidate immutable tag and SHA-256 approved.
- [ ] Production build, semantic typecheck, dependency and container scans pass in CI.
- [ ] Database backup verified; clean install and forward migration replay accepted.
- [ ] P584 test evidence is complete for every mandatory workstream.
- [ ] Legal, tax, excise, finance, security, provider and business approvals are signed.
- [ ] RPO/RTO, support rota, escalation contacts, monitoring and alert routing verified.
- [ ] Feature flags reviewed; prohibited modes remain disabled.
- [ ] Rollback plan rehearsed against a production-like environment.

## Deployment
- [ ] Announce change freeze and capture pre-deployment health.
- [ ] Deploy immutable API/web artifacts using approved rolling strategy.
- [ ] Apply forward-only migrations with lock/timeout monitoring.
- [ ] Run readiness, smoke and authenticated critical-journey checks.
- [ ] Verify audit, payment, stock, finance and integration queues.
- [ ] Keep live payments, provider dispatch and offline alcohol posting disabled unless separately signed off.

## Rollback / abort
Abort on migration error, elevated 5xx, failed health/readiness, tenant boundary issue, financial mismatch, duplicate posting, compliance failure or SLO breach. Stop workers, disable affected feature flags, route traffic to last known-good artifact only if schema compatibility is verified, and restore only under the approved data recovery plan. Never blindly roll back an irreversible financial migration.

## Current decision
NO-GO. This checklist is a controlled procedure, not evidence that production deployment or pilot acceptance occurred.
