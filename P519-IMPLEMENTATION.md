# P519 — Procurement and Supplier Management

Version: `0.519.0-dev`  
Status: **PARTIAL — developer preview**

## Delivered

- Forward migration `221_p519_procurement_supplier_controls.sql` adds supplier GSTIN, phone, email, payment terms and update timestamp; adds PO approval records and an immutable-by-convention procurement audit event stream.
- Organisation-scoped supplier list/create/update APIs with GSTIN and phone format validation and duplicate supplier-code handling.
- Purchase order creation validates the target outlet, active supplier and organisation-owned products. PO lines are persisted transactionally.
- PO submission is draft-only, requires at least one line and creates a pending approval request.
- Approval/rejection is pending-only, transactional and audited. Rejected POs are cancelled.
- Goods receipt posting requires an approved PO, prevents receiving above remaining ordered quantity, records accepted/rejected quantities, increases outlet stock only for accepted units, writes `RECEIPT` movements and optionally records batch/expiry data.
- A Procurement workspace supports supplier onboarding, supplier list, PO queue, submission and approval/rejection.
- AI remains disabled by default; no consumer alcohol purchase flow was added.

## API surface

- `GET/POST /api/v1/procurement/suppliers`
- `PATCH /api/v1/procurement/suppliers/:supplierId`
- `GET/POST /api/v1/procurement/purchase-orders`
- `POST /api/v1/procurement/purchase-orders/:poId/submit`
- `POST /api/v1/procurement/purchase-orders/:poId/review`
- `POST /api/v1/procurement/purchase-orders/:poId/receipts`

Permissions used: `procurement:read`, `procurement:manage`, `procurement:approve`. Migration seeds read/manage to owner and manager roles and approval to owner roles. Segregation-of-duties restrictions preventing a requester from approving their own PO remain outstanding.

## Not yet delivered / risks

- Full PO editor UI (select supplier, outlet, products, quantities and prices) is API-only.
- Goods receipt / GRN entry UI is not yet available; receipt posting is API-only.
- Supplier invoice capture, three-way invoice/PO/GRN matching workflow, payment scheduling, remittance and supplier statement UI remain incomplete.
- Multi-level approval thresholds, segregation-of-duties policy and configurable approval matrix are not implemented.
- Receipt API currently posts the full submitted receipt transactionally. Operational UAT must validate edge cases, concurrent receiving, tax/cost accounting and duplicate retries.
- No live PostgreSQL execution, dependency-backed TypeScript typecheck/build, authenticated API tests or browser E2E were run.
- Karnataka excise and GST treatment must be reviewed by qualified local compliance/accounting advisors before production.

## Verification

- `npm run verify:p519`: 14/14 static checks.
- `npm run verify:p518`: 12/12.
- `npm run verify:p517`: 15/15.
- P513–P516 static verifiers pass after version sync.
- TypeScript syntax transpilation: 226 files, 0 syntax diagnostics.
- Migration static validation: 220 ordered SQL migrations.
- P501/P502/P503 and P512 static release gates pass; P512 still explicitly marks production readiness false.
