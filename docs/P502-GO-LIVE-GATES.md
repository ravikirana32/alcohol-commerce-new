# P502 — Mandatory go-live gates (Karnataka / India)

**State: OPEN — no legal, security or operational approval is claimed.** P502 code is a developer preview.

## 1. Karnataka excise and legal review
- [ ] Retain Karnataka excise counsel / qualified compliance advisor to map each outlet's licence class, permitted activities, product categories, hours, service model and reporting obligations.
- [ ] Obtain written advice for retail sale versus bar/pub service, peg measures, open-bottle handling, breakage, wastage, complimentary pours, returns/refunds, stock movement and inter-outlet transfers.
- [ ] Confirm whether any consumer ordering, delivery, marketplace or online payment flow is lawful for the exact licence and outlet model. Keep restricted flows disabled unless written approval supports them.
- [ ] Verify statutory registers, invoices, tax treatment, excise records, retention, inspection exports and audit trail requirements against current rules and licence conditions.
- [ ] Map licence validity/renewal, outlet address, operating hours and permitted product/brand catalogue into operational access controls; test expiry/suspension fail-closed.
- [ ] Obtain written sign-off from counsel and the licensee/compliance owner. Record reviewer, date, scope and evidence.

## 2. Independent security assessment
- [ ] Threat model tenant/outlet isolation, cashier/manager roles, refunds, stock adjustments, bar/peg records, offline sync and privileged administration.
- [ ] SAST, dependency/SCA, secret scanning, container/image scanning and infrastructure configuration review.
- [ ] DAST/API penetration test covering authentication, authorisation, IDOR, injection, replay/idempotency, race conditions, rate limits and audit tampering.
- [ ] Verify encryption in transit/at rest, secrets management, backup restore, key rotation, log redaction and retention.
- [ ] Test offline device loss, local data protection, queue replay, conflict handling and duplicate prevention.
- [ ] Remediate all critical/high findings; obtain independent written report and risk acceptance for any residual findings.

## 3. Authorised outlet pilot
- [ ] Select only an appropriately licensed outlet and obtain written pilot authorisation from the licensee/compliance owner.
- [ ] Use staging/test data first; then run a controlled, limited pilot only after legal and security approvals.
- [ ] Verify opening/closing shifts, cash variance, split tenders, refunds, SKU-level restock, bar ticket refunds, quarantined peg returns, wastage, breakage, offline recovery and audit exports.
- [ ] Reconcile physical stock, open-bottle volume, sales, payments, refunds and statutory records daily with named signatories.
- [ ] Train staff, publish SOPs, define incident/escalation contacts, rollback plan and stop conditions.
- [ ] Obtain signed pilot acceptance and compliance owner approval before production rollout.

## 4. Technical release prerequisites
- [ ] Run migration 214 on a clean PostgreSQL database and upgrade from the supported P501 schema; verify rollback/recovery plan.
- [ ] Complete API/web typecheck and production build with locked dependencies.
- [ ] Run Vitest, API integration, browser E2E, concurrency and multi-tenant isolation tests.
- [ ] Validate backup/restore and observability/alerting in a production-like environment.

**Release rule:** any unchecked legal, security or pilot gate blocks live alcohol transactions. Do not treat this checklist or application controls as a substitute for legal advice, regulator approval or an independent security assessment.
