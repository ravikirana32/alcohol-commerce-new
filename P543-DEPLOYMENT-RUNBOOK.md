# P543 Deployment Runbook

**Scope:** controlled deployment procedure for a future approved release. This document does not authorize production deployment. Current decision is NO-GO.

## 1. Preconditions

1. Obtain a signed GO decision with all gates in `P543-RELEASE-GATE.json` set to `PASS` and evidence retained.
2. Confirm exact release tag, commit SHA, artifact checksum and dependency lockfiles.
3. Confirm approved maintenance window, business owner, incident commander, on-call engineering, DBA and rollback operator.
4. Verify production secrets are injected by the approved secret manager; do not place secrets in `.env`, logs, tickets or this repository.
5. Verify TLS, DNS, firewall/egress allowlists, database access, Redis access, storage and provider credentials in the target environment.
6. Take a verified pre-deployment backup and confirm restore procedure and rollback compatibility.
7. Confirm feature flags keep live payments, offline alcohol posting and outbound provider dispatch disabled unless their individual approvals are documented.

## 2. Preflight

Run from the repository root in the release environment:

```bash
node --version
npm --version
npm ci
npm run verify:p543
npm run check:syntax
npm run verify:migrations
npm run typecheck
npm run build
```

Run database preflight and migrations only under the approved change plan:

```bash
npm run preflight:migrations
npm run db:status
npm run db:migrate
npm run db:status
```

The P543 static gate verifier is expected to return exit code `2` while the manifest decision is NO-GO. This is an intentional safety stop, not a successful deployment preflight.

## 3. Controlled rollout (after GO only)

1. Deploy to staging and run smoke, authenticated journey, tenant isolation and provider sandbox tests.
2. Obtain explicit release-manager approval and verify backup restore point.
3. Deploy production application artifact using the platform's approved immutable deployment mechanism.
4. Apply only reviewed, backward-compatible migrations; do not run destructive schema changes without a separately approved migration plan.
5. Keep restricted feature flags disabled until the corresponding business and compliance sign-offs are verified.
6. Run health/readiness, login, tenant isolation, core POS read-only and monitoring checks.
7. Observe error rate, latency, queue depth, database health and business transaction metrics for the approved observation window.
8. Record deployment SHA, artifact checksum, migration version, operators, timestamps and all smoke-test results.

## 4. Stop conditions

Stop rollout and invoke rollback/incident procedure for failed readiness, elevated 5xx, data-integrity mismatch, tenant boundary violation, unexpected migration state, payment duplication, audit loss, queue backlog growth or critical business workflow failure.

## 5. Current limitation

No production deployment was performed for P543. Runtime environment, credentials, database, provider sandboxes and business approvals were not available as verified evidence in this delivery.
