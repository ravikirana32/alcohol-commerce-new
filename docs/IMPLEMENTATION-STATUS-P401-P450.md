# P401–P450 Implementation Status

P401–P450 adds 50 deterministic domain and policy modules, each with a smoke assertion. These modules improve reusable business-rule coverage but do not constitute a complete commercial POS platform.

- P401: Money and currency primitives — `domain/money.ts` (`toMinorUnits`).
- P402: Quantity and unit conversion — `domain/quantity.ts` (`convertMl`).
- P403: Idempotency key validation — `services/idempotencyKey.ts` (`validateIdempotencyKey`).
- P404: Safe pagination contract — `services/pagination.ts` (`normalisePage`).
- P405: API error classification — `services/apiError.ts` (`classifyApiError`).
- P406: Retail price book resolution — `services/priceBook.ts` (`resolveUnitPrice`).
- P407: Retail cart line aggregation — `services/cartAggregation.ts` (`aggregateCartLines`).
- P408: Tax component allocation — `services/taxComponents.ts` (`splitTaxComponents`).
- P409: Discount guardrails — `services/discountPolicy.ts` (`validateDiscount`).
- P410: Receipt snapshot integrity — `services/receiptSnapshot.ts` (`validateReceiptSnapshot`).
- P411: Stock ledger movement validation — `services/stockMovement.ts` (`validateStockMovement`).
- P412: Stock reservation availability — `services/stockReservation.ts` (`availableToPromise`).
- P413: Stock transfer dispatch guard — `services/transferDispatch.ts` (`canDispatchTransfer`).
- P414: Stock count variance — `services/stockCountVariance.ts` (`stockCountVariance`).
- P415: Reorder point calculation — `services/reorderPoint.ts` (`calculateReorderPoint`).
- P416: Bar table occupancy — `services/tableOccupancy.ts` (`transitionTable`).
- P417: Bar ticket line validation — `services/barTicketLine.ts` (`validateBarTicketLine`).
- P418: Open bottle balance invariant — `services/openBottleBalance.ts` (`applyBottleConsumption`).
- P419: Wastage reason and approval — `services/wastageApproval.ts` (`requiresWastageApproval`).
- P420: Shift cash variance — `services/shiftCashVariance.ts` (`calculateCashVariance`).
- P421: Supplier master validation — `services/supplierMaster.ts` (`validateSupplier`).
- P422: Purchase order approval threshold — `services/purchaseApproval.ts` (`requiresPurchaseApproval`).
- P423: Goods receipt quantity reconciliation — `services/goodsReceiptReconciliation.ts` (`reconcileGoodsReceipt`).
- P424: Supplier invoice three-way match — `services/threeWayMatch.ts` (`threeWayMatch`).
- P425: Accounts payable due-date aging — `services/payableAging.ts` (`agePayable`).
- P426: Payment settlement matching — `services/settlementMatch.ts` (`matchSettlement`).
- P427: Double-entry journal balancing — `services/journalBalance.ts` (`validateJournal`).
- P428: Account posting eligibility — `services/accountPosting.ts` (`assertPostableAccount`).
- P429: Accounting period lock — `services/accountingPeriod.ts` (`assertPeriodOpen`).
- P430: Accounting export control totals — `services/exportControlTotals.ts` (`calculateExportControlTotals`).
- P431: Permission scope matching — `services/permissionScope.ts` (`hasPermissionScope`).
- P432: Tenant boundary assertion — `services/tenantBoundary.ts` (`assertSameTenant`).
- P433: Append-only audit event shape — `services/auditEvent.ts` (`validateAuditEvent`).
- P434: Sensitive field masking — `services/piiMasking.ts` (`maskSensitiveValue`).
- P435: Rate-limit decision policy — `services/rateLimitPolicy.ts` (`isRateLimited`).
- P436: Offline sync cursor validation — `services/syncCursor.ts` (`validateSyncCursor`).
- P437: Offline conflict resolution by version — `services/versionConflict.ts` (`resolveVersionConflict`).
- P438: Device trust expiry — `services/deviceTrust.ts` (`isDeviceTrusted`).
- P439: Transactional outbox event envelope — `services/outboxEnvelope.ts` (`validateOutboxEnvelope`).
- P440: Retry backoff calculation — `services/retryBackoff.ts` (`retryDelayMs`).
- P441: Report date range validation — `services/reportRange.ts` (`validateReportRange`).
- P442: CSV formula injection protection — `services/csvSafety.ts` (`safeCsvCell`).
- P443: Dashboard metric denominator safety — `services/metricRate.ts` (`calculateRate`).
- P444: Readiness health aggregation — `services/readinessHealth.ts` (`aggregateReadiness`).
- P445: Feature flag default-off policy — `services/featureFlag.ts` (`isFeatureEnabled`).
- P446: Deployment environment preflight — `services/deploymentPreflight.ts` (`validateDeploymentEnvironment`).
- P447: Backup artifact verification — `services/backupArtifact.ts` (`validateBackupArtifact`).
- P448: Test evidence freshness — `services/evidenceFreshness.ts` (`isEvidenceFresh`).
- P449: Pilot acceptance checklist gate — `services/pilotAcceptance.ts` (`evaluatePilotAcceptance`).
- P450: Commercial release decision gate — `services/commercialReleaseGate.ts` (`commercialReleaseGate`).

## Release status
**NOT PRODUCTION READY / NOT APPROVED.** Route and database wiring, full UI workflows, PostgreSQL execution, complete workspace typecheck/build, browser E2E, provider certification, Karnataka excise/legal validation, security testing, pilot acceptance and production operations remain outstanding. AI stays disabled by default. Consumer alcohol transactions remain disabled unless explicitly lawful and licensed.
