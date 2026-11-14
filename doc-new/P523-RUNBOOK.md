# P523 Runbook

## Prerequisites
- Apply migrations in order, including `223_p523_trade_portals.sql`.
- Use separate test organisations for PLATFORM, BRAND, DISTRIBUTOR, RETAILER and BAR_OPERATOR.
- Assign the role codes and permissions from the migration.
- Do not use real alcohol trade data until legal/licence and privacy controls are approved.

## Example workflow
1. Brand/distributor organisation submits `POST /api/v1/trade/profile`.
2. Platform administrator approves using `POST /api/v1/platform/trade/profiles/:organisationId/approve`.
3. Active retailer/bar organisation requests a relationship with `POST /api/v1/trade/relationships`.
4. Supplier accepts/rejects with `POST /api/v1/trade/relationships/:relationshipId/decision`.
5. Supplier publishes its own active products through `POST /api/v1/trade/catalogue`.
6. Linked buyer browses `GET /api/v1/trade/catalogue?supplierOrganisationId=...`.
7. Buyer submits order using `POST /api/v1/trade/orders`.
8. Supplier advances status; buyer may cancel only while allowed by the state machine.

## Static verification
```bash
npm run verify:p523
npm run check:syntax
npm run verify:migrations
```

## Mandatory runtime acceptance
- Test buyer cannot read or mutate another buyer's relationship/order.
- Test supplier cannot create catalogue entries for another organisation's products.
- Test unapproved supplier cannot be requested or publish catalogue.
- Test non-platform user cannot approve profiles.
- Test rejected/suspended relationship blocks catalogue/order access.
- Test duplicate order number, repeated lines, invalid quantities and concurrent requests.
- Execute migration from empty supported database and upgrade baseline.
- Add UI/E2E and legal/licence review before operational rollout.
