# P203 Release Notes — Atomic checkout and server-side pricing

## Scope
Resolve outlet prices on the server and make bar ticket, payment, packaged stock and open-bottle deduction one atomic idempotent transaction.

## Changes
- Added outlet_product_prices with channel-specific price and tax-rate configuration
- Added authorised price management and price listing API routes
- Retail checkout now resolves RETAIL price and tax server-side
- Added POST /api/v1/bar/checkout with idempotency, price lookup, payment-total validation, stock/ml deduction and audit event in one transaction
- Added unique bar ticket idempotency index

## Risks / limitations
- Pricing and tax rules still require business-owner and tax-professional approval; this is not regulatory certification

## Validation
Archive integrity and source syntax checks are reported separately. No database execution or production certification is implied.
