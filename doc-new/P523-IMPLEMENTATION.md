# P523 — Brand, Distributor and Trade Portals

**Version:** 0.523.0-dev  
**Baseline:** P522 cumulative source  
**Status:** PARTIAL — organisation-scoped B2B trade APIs; no production approval.

## Implemented
- Brand/distributor profile submission by organisation type, with platform-admin approval gate.
- Buyer-to-supplier trade relationship request; supplier accepts or rejects.
- Trade catalogue publishing for organisation-owned active products.
- Catalogue visibility only to active linked buyers.
- Trade order submission with active relationship, active catalogue item and minimum order quantity checks.
- Transactional order header/line creation and supplier/buyer order visibility.
- Constrained trade-order status transitions with supplier/buyer actor checks.
- Role permissions for brand, distributor, retailer and bar roles.
- Cross-organisation records use explicit supplier/buyer organisation IDs; each API scopes actions to the authenticated organisation.

## API
- `POST /api/v1/trade/profile`
- `POST /api/v1/platform/trade/profiles/:organisationId/approve`
- `POST /api/v1/trade/relationships`
- `POST /api/v1/trade/relationships/:relationshipId/decision`
- `GET /api/v1/trade/relationships`
- `POST /api/v1/trade/catalogue`
- `GET /api/v1/trade/catalogue?supplierOrganisationId=<uuid>`
- `POST /api/v1/trade/orders`
- `POST /api/v1/trade/orders/:orderId/status`
- `GET /api/v1/trade/orders`

## Important limitations
- No portal UI has been implemented in P523; APIs only.
- Platform profile approval endpoint requires `platform:manage`; production platform-admin workflows, maker-checker controls and review evidence are outstanding.
- Trade order is not yet integrated with purchase orders, GRN, stock receiving, supplier invoice matching, payment or credit ledger.
- No negotiated price books, GST calculations, credit limits, schemes, rebates, partial fulfilment, shipment or delivery proof.
- No secure product media/document workflow.
- No legal/excise licence validation for interstate or intra-state trade eligibility. Obtain jurisdiction-specific legal review before use.
- API route-level static checks are not proof of PostgreSQL runtime behaviour or cross-organisation security.
- AI features, consumer alcohol discovery/transactions and live payment capture remain disabled.

## Verification
- `npm run verify:p523` — static source acceptance.
- Run `npm run check:syntax`, `npm run verify:migrations` and all cumulative verifiers.
- PostgreSQL migration execution, authenticated API tests, cross-org negative tests, browser E2E and load/security testing remain outstanding.
