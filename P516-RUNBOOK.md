# P516 Retail POS verification runbook

## Start local services

From the repository root:

```bash
npm install
cp .env.example .env
# Set DATABASE_URL, JWT_SECRET and WEB_ORIGIN in .env.
docker compose up -d --build
npm run db:migrate
npm run dev
```

## Verify source and migrations

```bash
npm run verify:p516
npm run check:syntax
npm run verify:migrations
npm run verify:p513
npm run verify:p514
npm run verify:p515
npm run verify:p512:static
```

## Runtime checks required before closing P516

```bash
npm run typecheck
npm run build
npm test
npm run test:e2e
```

Then verify with an authorised test organisation/outlet and non-production data:

1. Sign in with a cashier assigned to the test outlet.
2. Configure an active retail price and stock for an active product.
3. Scan its exact barcode; confirm the product is selected.
4. Search by SKU/name and confirm filtering works.
5. Add a product, increment/decrement quantity and remove a cart line.
6. Attempt checkout with a mismatched tender total; confirm server rejects it without changing stock.
7. Complete checkout with an exact tender allocation; confirm one sale, sale lines, payments, stock movement and audit event.
8. Simulate an uncertain response and retry the same checkout; confirm no duplicate sale or stock deduction.
9. Reuse the idempotency key with a different payload; confirm conflict.
10. Open sales history, inspect the receipt and complete an authorised partial refund; verify stock/refund ledger rules.
11. Print the browser receipt and compare the printed total to the server sale record.

Do not enable live payment capture, consumer ordering or live alcohol transactions until provider certification and all required licensing/legal approvals are independently verified.
