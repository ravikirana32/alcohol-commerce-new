# P557 Tenant-Aware API Route Coverage

- Route files scanned: 30
- Route declarations detected: 227
- Permission guard visible in declaration: 216
- Authentication guard visible in declaration: 220
- Explicit scope guard visible in declaration: 217
- Routes requiring manual scope review: 10
- Routes with path identifiers: 102

> Static inventory only. A scope check may be implemented inside a handler, service, repository, SQL predicate, or inherited router middleware and therefore may not appear in this declaration scan. Conversely, a visible guard does not prove correct tenant isolation. Review source and execute authenticated negative tests.

| Method | Route | File | Permission | Auth | Scope marker | Path IDs |
|---|---|---|---:|---:|---:|---|
| GET | `/reports/overview` | analytics.ts | yes | yes | yes | — |
| GET | `/reports/sales-trend` | analytics.ts | yes | yes | yes | — |
| GET | `/reports/top-products` | analytics.ts | yes | yes | yes | — |
| GET | `/reports/inventory-movements` | analytics.ts | yes | yes | yes | — |
| GET | `/reports/finance/profit-and-loss` | analytics.ts | yes | yes | yes | — |
| POST | `/bootstrap` | auth.ts | no | no | not visible | — |
| POST | `/login` | auth.ts | no | no | not visible | — |
| GET | `/me` | auth.ts | no | yes | not visible | — |
| POST | `/logout` | auth.ts | no | yes | not visible | — |
| GET | `/bar/tickets` | barCheckout.ts | yes | yes | yes | — |
| GET | `/bar/tickets/:ticketId` | barCheckout.ts | yes | yes | yes | ticketId |
| GET | `/bar/table-sessions` | barCheckout.ts | yes | yes | yes | — |
| POST | `/bar/table-sessions` | barCheckout.ts | yes | yes | yes | — |
| POST | `/bar/table-sessions/:sessionId/transfer` | barCheckout.ts | yes | yes | yes | sessionId |
| POST | `/bar/table-sessions/:sessionId/merge` | barCheckout.ts | yes | yes | yes | sessionId |
| POST | `/bar/table-sessions/:sessionId/close` | barCheckout.ts | yes | yes | yes | sessionId |
| GET | `/bar/kot` | barCheckout.ts | yes | yes | yes | — |
| POST | `/bar/kot/:kotId/status` | barCheckout.ts | yes | yes | yes | kotId |
| POST | `/bar/checkout` | barCheckout.ts | yes | yes | yes | — |
| GET | `/capabilities/phases` | capabilities.ts | no | no | not visible | — |
| GET | `/catalogue/categories` | catalogue.ts | yes | yes | yes | — |
| POST | `/catalogue/categories` | catalogue.ts | yes | yes | yes | — |
| PATCH | `/catalogue/categories/:id` | catalogue.ts | yes | yes | yes | id |
| GET | `/catalogue/brands` | catalogue.ts | yes | yes | yes | — |
| POST | `/catalogue/brands` | catalogue.ts | yes | yes | yes | — |
| PATCH | `/catalogue/brands/:id` | catalogue.ts | yes | yes | yes | id |
| GET | `/catalogue/products` | catalogue.ts | yes | yes | yes | — |
| POST | `/catalogue/products` | catalogue.ts | yes | yes | yes | — |
| PATCH | `/catalogue/products/:productId` | catalogue.ts | yes | yes | yes | productId |
| GET | `/catalogue/products/export` | catalogue.ts | yes | yes | yes | — |
| POST | `/catalogue/products/import` | catalogue.ts | yes | yes | yes | — |
| GET | `/catalogue/products/:productId/variants` | catalogue.ts | yes | yes | yes | productId |
| POST | `/catalogue/products/:productId/variants` | catalogue.ts | yes | yes | yes | productId |
| PATCH | `/catalogue/variants/:variantId` | catalogue.ts | yes | yes | yes | variantId |
| GET | `/outlets/:outletId/prices/history` | catalogue.ts | yes | yes | yes | outletId |
| GET | `/devices` | devices.ts | yes | yes | yes | — |
| POST | `/devices` | devices.ts | yes | yes | yes | — |
| POST | `/devices/:deviceId/challenge` | devices.ts | yes | yes | yes | deviceId |
| POST | `/devices/:deviceId/attest` | devices.ts | yes | yes | yes | deviceId |
| POST | `/devices/:deviceId/revoke` | devices.ts | yes | yes | yes | deviceId |
| POST | `/outlet-transfers` | ecosystem.ts | yes | yes | yes | — |
| POST | `/outlet-transfers/:transferId/receive` | ecosystem.ts | yes | yes | yes | transferId |
| POST | `/finance/expenses` | ecosystem.ts | yes | yes | yes | — |
| GET | `/finance/summary` | ecosystem.ts | yes | yes | yes | — |
| POST | `/finance/exports` | ecosystem.ts | yes | yes | yes | — |
| POST | `/crm/customers` | ecosystem.ts | yes | yes | yes | — |
| POST | `/crm/customers/:customerId/consents` | ecosystem.ts | yes | yes | yes | customerId |
| POST | `/brands/campaigns` | ecosystem.ts | yes | yes | yes | — |
| POST | `/brands/campaigns/:campaignId/review` | ecosystem.ts | yes | yes | yes | campaignId |
| GET | `/brands/campaigns` | ecosystem.ts | yes | yes | yes | — |
| POST | `/platform/distributor-assignments` | ecosystem.ts | yes | yes | yes | — |
| POST | `/distributor/orders` | ecosystem.ts | yes | yes | yes | — |
| GET | `/distributor/orders` | ecosystem.ts | yes | yes | yes | — |
| POST | `/trade/schemes/:schemeId/enrol` | ecosystem.ts | yes | yes | yes | schemeId |
| POST | `/trade/schemes` | ecosystem.ts | yes | yes | yes | — |
| POST | `/trade/visits` | ecosystem.ts | yes | yes | yes | — |
| POST | `/trade/visits/:visitId/checkout` | ecosystem.ts | yes | yes | yes | visitId |
| POST | `/platform/consumer-discovery/:organisationId/enable` | ecosystem.ts | yes | yes | yes | organisationId |
| POST | `/consumer/listings` | ecosystem.ts | yes | yes | yes | — |
| POST | `/consumer/listings/:listingId/review` | ecosystem.ts | yes | yes | yes | listingId |
| POST | `/analytics/reports` | ecosystem.ts | yes | yes | yes | — |
| GET | `/analytics/sales-summary` | ecosystem.ts | yes | yes | yes | — |
| POST | `/sync/devices` | ecosystem.ts | yes | yes | yes | — |
| POST | `/sync/batches` | ecosystem.ts | yes | yes | yes | — |
| POST | `/platform/ops/alerts` | ecosystem.ts | yes | yes | yes | — |
| POST | `/platform/ops/release-checks` | ecosystem.ts | yes | yes | yes | — |
| GET | `/enterprise-integrations` | enterpriseIntegrations.ts | yes | yes | yes | — |
| POST | `/enterprise-integrations` | enterpriseIntegrations.ts | yes | yes | yes | — |
| POST | `/enterprise-integrations/:integrationId/configure` | enterpriseIntegrations.ts | yes | yes | yes | integrationId |
| POST | `/enterprise-integrations/:integrationId/status` | enterpriseIntegrations.ts | yes | yes | yes | integrationId |
| GET | `/enterprise-integrations/:integrationId/events` | enterpriseIntegrations.ts | yes | yes | yes | integrationId |
| POST | `/excise/rule-packs` | exciseCompliance.ts | yes | yes | yes | — |
| GET | `/excise/rule-packs` | exciseCompliance.ts | yes | yes | yes | — |
| GET | `/excise/rule-packs/:packId/rules` | exciseCompliance.ts | yes | yes | yes | packId |
| POST | `/excise/rule-packs/:packId/rules` | exciseCompliance.ts | yes | yes | yes | packId |
| POST | `/excise/rule-packs/:packId/submit` | exciseCompliance.ts | yes | yes | yes | packId |
| POST | `/excise/rule-packs/:packId/review` | exciseCompliance.ts | yes | yes | yes | packId |
| POST | `/excise/rule-packs/:packId/activate` | exciseCompliance.ts | yes | yes | yes | packId |
| GET | `/outlets/:outletId/excise/conditions` | exciseCompliance.ts | yes | yes | yes | outletId |
| POST | `/outlets/:outletId/licences/:licenceId/excise-conditions` | exciseCompliance.ts | yes | yes | yes | outletId, licenceId |
| POST | `/excise/licence-conditions/:conditionId/review` | exciseCompliance.ts | yes | yes | yes | conditionId |
| POST | `/excise/dry-day-orders` | exciseCompliance.ts | yes | yes | yes | — |
| GET | `/excise/dry-day-orders` | exciseCompliance.ts | yes | yes | yes | — |
| POST | `/excise/dry-day-orders/:orderId/review` | exciseCompliance.ts | yes | yes | yes | orderId |
| POST | `/excise/evaluate` | exciseCompliance.ts | yes | yes | yes | — |
| GET | `/excise/decisions` | exciseCompliance.ts | yes | yes | yes | — |
| GET | `/finance/accounts` | finance.ts | yes | yes | yes | — |
| POST | `/finance/accounts` | finance.ts | yes | yes | yes | — |
| POST | `/finance/journals` | finance.ts | yes | yes | yes | — |
| GET | `/finance/trial-balance` | finance.ts | yes | yes | yes | — |
| PUT | `/finance/accounting-mappings/:eventType` | financeAutomation.ts | yes | yes | yes | eventType |
| POST | `/finance/source-postings` | financeAutomation.ts | yes | yes | yes | — |
| POST | `/finance/periods` | financeAutomation.ts | yes | yes | yes | — |
| GET | `/finance/periods` | financeAutomation.ts | yes | yes | yes | — |
| POST | `/finance/periods/:periodId/close` | financeAutomation.ts | yes | yes | yes | periodId |
| GET | `/live` | health.ts | no | no | not visible | — |
| GET | `/ready` | health.ts | no | no | not visible | — |
| POST | `/offline/posting-intents/:intentId/authoritative-check` | offlineAuthoritative.ts | yes | yes | yes | intentId |
| GET | `/offline/authoritative-checks` | offlineAuthoritative.ts | yes | yes | yes | — |
| POST | `/offline/posting-intents/:intentId/post` | offlineLedgerPosting.ts | yes | yes | yes | intentId |
| GET | `/offline/posting-executions` | offlineLedgerPosting.ts | yes | yes | yes | — |
| POST | `/offline/posting-intents/:intentId/approval` | offlinePostingApproval.ts | yes | yes | yes | intentId |
| GET | `/offline/posting-approvals` | offlinePostingApproval.ts | yes | yes | yes | — |
| GET | `/offline/reconciliation/events` | offlineReconciliation.ts | yes | yes | yes | — |
| POST | `/offline/reconciliation/events/:eventId/decision` | offlineReconciliation.ts | yes | yes | yes | eventId |
| GET | `/offline/recovery/cases` | offlineRecovery.ts | yes | yes | yes | — |
| POST | `/offline/recovery/executions/:executionId/case` | offlineRecovery.ts | yes | yes | yes | executionId |
| POST | `/offline/recovery/cases/:caseId/triage` | offlineRecovery.ts | yes | yes | yes | caseId |
| POST | `/offline/recovery/cases/:caseId/retry-request` | offlineRecovery.ts | yes | yes | yes | caseId |
| POST | `/offline/recovery/cases/:caseId/cancel` | offlineRecovery.ts | yes | yes | yes | caseId |
| POST | `/offline/recovery/cases/:caseId/compensation-request` | offlineRecovery.ts | yes | yes | yes | caseId |
| POST | `/offline/recovery/cases/:caseId/compensation-decision` | offlineRecovery.ts | yes | yes | yes | caseId |
| POST | `/offline/devices` | offlineSync.ts | yes | yes | yes | — |
| POST | `/offline/devices/:deviceId/revoke` | offlineSync.ts | yes | yes | yes | deviceId |
| POST | `/offline/sync-batches` | offlineSync.ts | yes | yes | yes | — |
| GET | `/offline/sync-batches` | offlineSync.ts | yes | yes | yes | — |
| POST | `/offline/reconciliation/events/:eventId/validate` | offlineValidation.ts | yes | yes | yes | eventId |
| GET | `/offline/posting-intents` | offlineValidation.ts | yes | yes | yes | — |
| POST | `/organisations` | operations.ts | yes | yes | yes | — |
| GET | `/organisations` | operations.ts | yes | yes | yes | — |
| POST | `/outlets` | operations.ts | yes | yes | yes | — |
| POST | `/outlets/:outletId/status` | operations.ts | yes | yes | yes | outletId |
| GET | `/outlets` | operations.ts | yes | yes | yes | — |
| POST | `/outlets/:outletId/licences` | operations.ts | yes | yes | yes | outletId |
| POST | `/licences/:licenceId/review` | operations.ts | yes | yes | yes | licenceId |
| GET | `/outlets/:outletId/licences` | operations.ts | yes | yes | yes | outletId |
| POST | `/catalogue/products` | operations.ts | yes | yes | yes | — |
| GET | `/catalogue/products` | operations.ts | yes | yes | yes | — |
| PATCH | `/catalogue/products/:productId` | operations.ts | yes | yes | yes | productId |
| POST | `/inventory/receipts` | operations.ts | yes | yes | yes | — |
| GET | `/inventory/balances` | operations.ts | yes | yes | yes | — |
| POST | `/inventory/adjustments` | operations.ts | yes | yes | yes | — |
| GET | `/inventory/batches` | operations.ts | yes | yes | yes | — |
| POST | `/inventory/batches` | operations.ts | yes | yes | yes | — |
| GET | `/inventory/transfers` | operations.ts | yes | yes | yes | — |
| POST | `/inventory/transfers` | operations.ts | yes | yes | yes | — |
| GET | `/inventory/transfers/:transferId` | operations.ts | yes | yes | yes | transferId |
| POST | `/inventory/transfers/:transferId/dispatch` | operations.ts | yes | yes | yes | transferId |
| POST | `/inventory/transfers/:transferId/receive` | operations.ts | yes | yes | yes | transferId |
| GET | `/inventory/stocktakes` | operations.ts | yes | yes | yes | — |
| POST | `/inventory/stocktakes` | operations.ts | yes | yes | yes | — |
| GET | `/inventory/stocktakes/:stocktakeId` | operations.ts | yes | yes | yes | stocktakeId |
| PUT | `/inventory/stocktakes/:stocktakeId/lines/:productId` | operations.ts | yes | yes | yes | stocktakeId, productId |
| POST | `/inventory/stocktakes/:stocktakeId/submit` | operations.ts | yes | yes | yes | stocktakeId |
| POST | `/inventory/stocktakes/:stocktakeId/approve` | operations.ts | yes | yes | yes | stocktakeId |
| POST | `/outlets/:outletId/prices` | operations.ts | yes | yes | yes | outletId |
| GET | `/outlets/:outletId/prices` | operations.ts | yes | yes | yes | outletId |
| POST | `/retail/sales` | operations.ts | yes | yes | yes | — |
| GET | `/retail/sales` | operations.ts | yes | yes | yes | — |
| GET | `/retail/sales/:saleId` | operations.ts | yes | yes | yes | saleId |
| POST | `/bar/open-bottles` | operations.ts | yes | yes | yes | — |
| POST | `/bar/peg-transactions` | operations.ts | yes | yes | yes | — |
| GET | `/bar/open-bottles` | operations.ts | yes | yes | yes | — |
| POST | `/bar/open-bottles/:bottleId/reservations` | operations.ts | yes | yes | yes | bottleId |
| POST | `/bar/bottle-reservations/:reservationId/release` | operations.ts | yes | yes | yes | reservationId |
| GET | `/bar/bottle-reservations` | operations.ts | yes | yes | yes | — |
| POST | `/bar/tickets` | operations.ts | yes | yes | yes | — |
| POST | `/bar/tickets/:ticketId/payments` | operations.ts | yes | yes | yes | ticketId |
| POST | `/shifts/open` | operations.ts | yes | yes | yes | — |
| GET | `/shifts/current` | operations.ts | yes | yes | yes | — |
| GET | `/shifts/:shiftId/preview` | operations.ts | yes | yes | yes | shiftId |
| POST | `/shifts/:shiftId/close` | operations.ts | yes | yes | yes | shiftId |
| GET | `/organisation/current` | organisationAccess.ts | yes | yes | yes | — |
| PATCH | `/organisation/current` | organisationAccess.ts | yes | yes | yes | — |
| GET | `/organisation/members` | organisationAccess.ts | yes | yes | yes | — |
| POST | `/organisation/invitations` | organisationAccess.ts | yes | yes | yes | — |
| POST | `/organisation/invitations/accept` | organisationAccess.ts | no | no | not visible | — |
| PATCH | `/organisation/members/:userId` | organisationAccess.ts | yes | yes | yes | userId |
| PUT | `/organisation/members/:userId/outlets` | organisationAccess.ts | yes | yes | yes | userId |
| GET | `/organisation/audit-events` | organisationAccess.ts | yes | yes | yes | — |
| POST | `/payments/provider-webhooks/:provider` | paymentLifecycle.ts | no | yes | yes | provider |
| POST | `/shifts/:shiftId/cash-counts` | paymentLifecycle.ts | yes | yes | yes | shiftId |
| GET | `/payments/provider-events` | paymentLifecycle.ts | yes | yes | yes | — |
| POST | `/payments/settlements` | paymentLifecycle.ts | yes | yes | yes | — |
| POST | `/payments/exceptions/:exceptionId/resolve` | paymentLifecycle.ts | yes | yes | yes | exceptionId |
| GET | `/payments/exceptions` | paymentLifecycle.ts | yes | yes | yes | — |
| POST | `/payments/tender-allocations` | paymentLifecycle.ts | yes | yes | yes | — |
| POST | `/payments/settlements/:batchId/match` | paymentLifecycle.ts | yes | yes | yes | batchId |
| POST | `/payments/settlements/:batchId/bank-confirm` | paymentLifecycle.ts | yes | yes | yes | batchId |
| POST | `/payments/reconciliation/import` | paymentReconciliation.ts | yes | yes | yes | — |
| POST | `/payments/reconciliation/:batchId/match` | paymentReconciliation.ts | yes | yes | yes | batchId |
| GET | `/payments/reconciliation/:batchId` | paymentReconciliation.ts | yes | yes | yes | batchId |
| GET | `/operating-modes` | platform.ts | no | no | not visible | — |
| GET | `/procurement/suppliers` | procurement.ts | yes | yes | yes | — |
| POST | `/procurement/suppliers` | procurement.ts | yes | yes | yes | — |
| PATCH | `/procurement/suppliers/:supplierId` | procurement.ts | yes | yes | yes | supplierId |
| GET | `/procurement/purchase-orders` | procurement.ts | yes | yes | yes | — |
| POST | `/procurement/purchase-orders` | procurement.ts | yes | yes | yes | — |
| POST | `/procurement/purchase-orders/:poId/submit` | procurement.ts | yes | yes | yes | poId |
| POST | `/procurement/purchase-orders/:poId/review` | procurement.ts | yes | yes | yes | poId |
| POST | `/procurement/purchase-orders/:poId/receipts` | procurement.ts | yes | yes | yes | poId |
| GET | `/security/audit-events` | securityAudit.ts | yes | yes | yes | — |
| POST | `/retail/sales/:saleId/refunds` | settlements.ts | yes | yes | yes | saleId |
| POST | `/bar/tickets/:ticketId/refunds` | settlements.ts | yes | yes | yes | ticketId |
| GET | `/bar/peg-quarantine` | settlements.ts | yes | yes | yes | — |
| POST | `/bar/peg-quarantine/:restorationId/disposition` | settlements.ts | yes | yes | yes | restorationId |
| POST | `/shifts/:shiftId/cash-movements` | settlements.ts | yes | yes | yes | shiftId |
| GET | `/shifts/:shiftId/cash-movements` | settlements.ts | yes | yes | yes | shiftId |
| GET | `/tax/rule-packs` | taxPricing.ts | yes | yes | yes | — |
| POST | `/tax/rule-packs` | taxPricing.ts | yes | yes | yes | — |
| GET | `/tax/rule-packs/:packId/components` | taxPricing.ts | yes | yes | yes | packId |
| POST | `/tax/rule-packs/:packId/components` | taxPricing.ts | yes | yes | yes | packId |
| POST | `/tax/rule-packs/:packId/submit` | taxPricing.ts | yes | yes | yes | packId |
| POST | `/tax/rule-packs/:packId/review` | taxPricing.ts | yes | yes | yes | packId |
| POST | `/tax/rule-packs/:packId/activate` | taxPricing.ts | yes | yes | yes | packId |
| POST | `/tax/products/:productId/profiles` | taxPricing.ts | yes | yes | yes | productId |
| GET | `/tax/products/:productId/profiles` | taxPricing.ts | yes | yes | yes | productId |
| POST | `/tax/product-profiles/:profileId/review` | taxPricing.ts | yes | yes | yes | profileId |
| POST | `/outlets/:outletId/prices` | taxPricing.ts | yes | yes | yes | outletId |
| POST | `/outlets/:outletId/prices/:priceId/review` | taxPricing.ts | yes | yes | yes | outletId, priceId |
| GET | `/tax/outlets/:outletId/prices` | taxPricing.ts | yes | yes | yes | outletId |
| POST | `/tax/quote` | taxPricing.ts | yes | yes | yes | — |
| GET | `/tax/attempts` | taxPricing.ts | yes | yes | yes | — |
| GET | `/tax/snapshots` | taxPricing.ts | yes | yes | yes | — |
| GET | `/context` | tenant.ts | no | yes | not visible | — |
| POST | `/trade/profile` | tradePortal.ts | yes | yes | yes | — |
| POST | `/platform/trade/profiles/:organisationId/approve` | tradePortal.ts | yes | yes | yes | organisationId |
| POST | `/trade/relationships` | tradePortal.ts | yes | yes | yes | — |
| POST | `/trade/relationships/:relationshipId/decision` | tradePortal.ts | yes | yes | yes | relationshipId |
| GET | `/trade/relationships` | tradePortal.ts | yes | yes | yes | — |
| POST | `/trade/catalogue` | tradePortal.ts | yes | yes | yes | — |
| GET | `/trade/catalogue` | tradePortal.ts | yes | yes | yes | — |
| POST | `/trade/orders` | tradePortal.ts | yes | yes | yes | — |
| POST | `/trade/orders/:orderId/status` | tradePortal.ts | yes | yes | yes | orderId |
| GET | `/trade/orders` | tradePortal.ts | yes | yes | yes | — |
| POST | `/trade/orders/:orderId/fulfilment-evidence` | tradePortal.ts | yes | yes | yes | orderId |
| GET | `/trade/orders/:orderId/fulfilment-evidence` | tradePortal.ts | yes | yes | yes | orderId |
