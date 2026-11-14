# P519 Procurement Runbook (Developer Preview)

## 1. Start services

From the repository root:

```bash
cp .env.example .env
# Set DATABASE_URL, JWT_SECRET and other required local values.
npm install
npm run docker:up
```

If using the Docker Compose database, ensure the API's `DATABASE_URL` points to the compose PostgreSQL service, not localhost from inside the API container.

## 2. Apply migrations

```bash
npm run db:migrate
npm run db:status
```

Migration `221_p519_procurement_supplier_controls.sql` must be applied after the P518 baseline migrations. Back up the database first; do not edit an already-applied migration.

## 3. Verify static invariants

```bash
npm run verify:p519
npm run verify:p518
npm run verify:p517
npm run check:syntax
npm run verify:migrations
```

## 4. API workflow

Use a valid organisation-scoped bearer token with the relevant procurement permissions.

1. Create a supplier using `POST /api/v1/procurement/suppliers` with `name`, `supplierCode` and optional `gstin`, `phone`, `email`, `paymentTermsDays`, `contact`.
2. Create a PO using `POST /api/v1/procurement/purchase-orders` with `outletId`, `supplierId`, `poNumber`, optional `expectedAt`, and `lines` containing `productId`, `orderedUnits`, `unitCost`.
3. Submit using `POST /api/v1/procurement/purchase-orders/:poId/submit`.
4. Approve or reject using `POST /api/v1/procurement/purchase-orders/:poId/review` with `{ "decision": "APPROVED" }` or `REJECTED` and optional notes.
5. Post accepted goods using `POST /api/v1/procurement/purchase-orders/:poId/receipts`. Each line requires `purchaseOrderLineId`, `receivedUnits`, `acceptedUnits`, `unitCost`; optionally include `batchNumber` and `expiryDate`.

## 5. Important controls

- Only active suppliers can be used to create POs.
- PO and product/outlet references are organisation scoped.
- Only DRAFT POs can be submitted; only PENDING approvals can be reviewed.
- Only approved POs can receive stock.
- Received quantity cannot exceed the outstanding ordered quantity.
- Rejected goods do not increase stock. Accepted goods update stock balances and movement ledger.
- Use unique PO and receipt numbers per organisation.

## 6. Before pilot

Run clean-install and upgrade migrations on disposable PostgreSQL databases, add role grants for procurement permissions, exercise duplicate requests and concurrent receipts, verify accounting/tax treatment, implement the missing PO/GRN UI, and complete authenticated API/browser tests. Do not enable in production based only on static verification.
