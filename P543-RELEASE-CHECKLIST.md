# P543 Release Checklist

**Release:** `0.543.0-dev`  
**Decision at delivery:** **NO-GO — developer preview only**

This checklist is an evidence register, not a claim that the listed activities have passed. Record the evidence URI, execution date, environment, operator and approver before changing any gate in `P543-RELEASE-GATE.json` to `PASS`.

## Mandatory gates

- [ ] Clean dependency installation, production builds and semantic TypeScript checks pass in CI.
- [ ] PostgreSQL clean install, sequential upgrade, rollback and data-integrity checks pass.
- [ ] Playwright runtime passes, including authenticated retail, bar, shift, stock, procurement, refund and finance journeys.
- [ ] Tenant isolation, role matrix, IDOR, API abuse and independent penetration testing pass.
- [ ] Current Karnataka excise/GST rules and all statutory tax packs are reviewed and signed by qualified legal/excise/CA owners.
- [ ] Payment provider sandbox certification, tender allocation, refunds, chargebacks, webhook replay protection and bank settlement reconciliation pass.
- [ ] Finance approves journals, inventory valuation, COGS, tax, trial balance, P&L and balance sheet reconciliation.
- [ ] Hardware-backed device attestation and secure-time controls pass; offline alcohol posting remains disabled until explicit approval.
- [ ] Integration adapters, SSRF-safe egress, signing, retry, dead-letter handling and provider certification pass.
- [ ] Backup restore, disaster recovery, failover, load/soak and measured RPO/RTO drills pass.
- [ ] Monitoring, alert routing, on-call ownership and incident response rehearsal pass.
- [ ] Business UAT, staff training, defects and pilot acceptance are signed by named owners.
- [ ] Production secrets, TLS, access controls and environment configuration are independently reviewed.
- [ ] Release change approval and timed rollback rehearsal pass.

## Hard-stop controls

- No live payment capture without provider, security and finance approval.
- No offline alcohol sale/posting without excise/legal approval and verified device attestation plus secure time.
- No external provider dispatch until egress controls and provider certification pass.
- No production deployment while any mandatory gate is `OPEN`, `NOT_RUN` or lacks evidence.

## Evidence record template

For every gate record: `gate_id`, evidence link/location, commit/build ID, environment, execution timestamp, operator, result, defect references, approver and approval timestamp.
