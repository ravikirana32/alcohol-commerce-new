# P543 Rollback Plan

**Status:** procedure drafted; rollback rehearsal NOT RUN. Production use requires approved change record and environment-specific commands.

## Principles

- Prefer application rollback to a previously verified immutable artifact when the database schema remains backward compatible.
- Never assume a database downgrade is safe. Use forward-fix or restore only under DBA-approved recovery decision.
- Preserve audit, payment, inventory and order evidence. Never delete financial or statutory records to make a rollback appear clean.
- Freeze payment capture, provider dispatch and offline alcohol posting if integrity is uncertain.

## Decision sequence

1. Incident commander declares rollback and records trigger, time, build SHA and affected tenants/outlets.
2. Stop further rollout; disable affected feature flags and pause external dispatch where safe.
3. Assess whether writes occurred and whether schema/data changes are backward compatible.
4. If application-only rollback is safe, redeploy the last known-good immutable artifact.
5. If data/schema integrity is uncertain, stop writes and engage DBA; select restore or forward-fix based on measured recovery point and approved runbook.
6. Reconcile orders, tenders, refunds, inventory movements, journals, webhooks and outbox records after recovery.
7. Verify tenant isolation, health/readiness, audit continuity and business smoke tests before reopening traffic.
8. Obtain business, finance and security approval before re-enabling restricted capabilities.
9. Preserve logs, backups, deployment records and incident timeline; complete root-cause review.

## Required rehearsal evidence

- Timed application rollback and database recovery rehearsal in a production-like environment.
- Verified backup integrity and restore with measured RPO/RTO.
- Reconciliation proving no lost/duplicated orders, tenders, refunds, inventory postings or journals.
- Named operator/approver, command transcript, timestamps and defect disposition.

## Environment-specific fields to complete before use

- Previous artifact/tag and checksum.
- Deployment platform and exact rollback command.
- Database backup identifier, restore procedure and recovery point.
- Migration compatibility matrix.
- Incident commander, DBA, security, finance and business contacts.
- Traffic freeze and provider pause procedures.
