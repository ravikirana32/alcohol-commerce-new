# P559 SQL Tenant Predicate Audit

- TypeScript files scanned: 236
- Direct query template literals inspected: 442
- Statements with explicit organisation predicate: 192
- Outlet-only predicate: 2
- Manual review required: 248
- Mutation statements: 264

## Method and limitations

Heuristic static scan of SQL template literals passed directly to .query(); does not resolve helper-built SQL, parameterized fragments, CTE semantics, joins, row-level security, or runtime query paths.

## Manual-review candidates

- [SELECT apps/api/src/db/seed-demo-users.ts:26 — tables: organisations
- [UPDATE apps/api/src/db/seed-demo-users.ts:32 — tables: organisations
- [INSERT apps/api/src/db/seed-demo-users.ts:37 — tables: organisations
- [INSERT apps/api/src/db/seed-demo-users.ts:45 — tables: outlets, SET
- [SELECT apps/api/src/db/seed-demo-users.ts:52 — tables: role_permissions
- [INSERT apps/api/src/db/seed-demo-users.ts:65 — tables: users, SET
- [INSERT apps/api/src/db/seed-demo-users.ts:75 — tables: organisation_memberships, SET
- [INSERT apps/api/src/db/seed-demo-users.ts:81 — tables: user_outlet_access
- [SELECT apps/api/src/middleware/authenticate.ts:29 — tables: auth_sessions, users
- [INSERT apps/api/src/middleware/securityRateLimit.ts:13 — tables: p583_rate_limit_buckets, SET
- [INSERT apps/api/src/routes/auth.ts:63 — tables: users
- [SELECT apps/api/src/routes/auth.ts:83 — tables: users
- [SELECT apps/api/src/routes/auth.ts:96 — tables: organisation_memberships
- [SELECT apps/api/src/routes/barCheckout.ts:84 — tables: bar_refund_peg_restorations, bar_ticket_lines
- [INSERT apps/api/src/routes/barCheckout.ts:124 — tables: bar_table_sessions
- [INSERT apps/api/src/routes/barCheckout.ts:129 — tables: audit_events
- [INSERT apps/api/src/routes/barCheckout.ts:151 — tables: audit_events
- [INSERT apps/api/src/routes/barCheckout.ts:176 — tables: audit_events
- [INSERT apps/api/src/routes/barCheckout.ts:194 — tables: audit_events
- [INSERT apps/api/src/routes/barCheckout.ts:230 — tables: audit_events
- [INSERT apps/api/src/routes/barCheckout.ts:317 — tables: bar_tickets
- [INSERT apps/api/src/routes/barCheckout.ts:324 — tables: bar_kot_orders
- [UPDATE apps/api/src/routes/barCheckout.ts:350 — tables: open_bottles
- [INSERT apps/api/src/routes/barCheckout.ts:355 — tables: peg_transactions
- [INSERT apps/api/src/routes/barCheckout.ts:378 — tables: bar_ticket_lines
- [INSERT apps/api/src/routes/barCheckout.ts:393 — tables: audit_events
- [INSERT apps/api/src/routes/catalogue.ts:20 — tables: product_categories
- [INSERT apps/api/src/routes/deviceOperations.ts:23 — tables: p580_device_health_events
- [SELECT apps/api/src/routes/deviceOperations.ts:31 — tables: p580_device_health_events, pos_devices
- [SELECT apps/api/src/routes/deviceOperations.ts:35 — tables: p580_offline_sync_checkpoints, offline_sync_devices
- [INSERT apps/api/src/routes/devices.ts:28 — tables: pos_devices, SET
- [INSERT apps/api/src/routes/devices.ts:45 — tables: pos_device_challenges
- [SELECT apps/api/src/routes/devices.ts:58 — tables: pos_device_challenges
- [INSERT apps/api/src/routes/ecosystem.ts:25 — tables: outlet_transfers
- [INSERT apps/api/src/routes/ecosystem.ts:65 — tables: expenses
- [INSERT apps/api/src/routes/ecosystem.ts:80 — tables: accounting_exports
- [INSERT apps/api/src/routes/ecosystem.ts:88 — tables: customers, SET
- [INSERT apps/api/src/routes/ecosystem.ts:98 — tables: customer_consents
- [INSERT apps/api/src/routes/ecosystem.ts:137 — tables: distributor_outlet_assignments, SET
- [INSERT apps/api/src/routes/ecosystem.ts:167 — tables: trade_scheme_participants, SET
- [INSERT apps/api/src/routes/ecosystem.ts:185 — tables: field_visits
- [INSERT apps/api/src/routes/ecosystem.ts:199 — tables: consumer_discovery_settings, SET
- [INSERT apps/api/src/routes/ecosystem.ts:208 — tables: consumer_public_listings
- [INSERT apps/api/src/routes/ecosystem.ts:251 — tables: device_registrations
- [INSERT apps/api/src/routes/ecosystem.ts:267 — tables: sync_batches
- [INSERT apps/api/src/routes/ecosystem.ts:290 — tables: release_checks, SET
- [INSERT apps/api/src/routes/enterpriseIntegrations.ts:17 — tables: security_audit_events
- [INSERT apps/api/src/routes/enterpriseIntegrations.ts:34 — tables: enterprise_integrations
- [INSERT apps/api/src/routes/enterpriseIntegrations.ts:87 — tables: p582_provider_certification_runs
- [INSERT apps/api/src/routes/exciseCompliance.ts:22 — tables: excise_rule_packs
- [INSERT apps/api/src/routes/exciseCompliance.ts:24 — tables: excise_rule_pack_audit
- [SELECT apps/api/src/routes/exciseCompliance.ts:29 — tables: excise_rule_packs, excise_rule_pack_rules
- [INSERT apps/api/src/routes/exciseCompliance.ts:47 — tables: excise_rule_pack_rules, SET
- [INSERT apps/api/src/routes/exciseCompliance.ts:50 — tables: excise_rule_pack_audit
- [UPDATE apps/api/src/routes/exciseCompliance.ts:57 — tables: excise_rule_packs
- [INSERT apps/api/src/routes/exciseCompliance.ts:60 — tables: excise_rule_pack_audit
- [UPDATE apps/api/src/routes/exciseCompliance.ts:77 — tables: excise_rule_packs
- [INSERT apps/api/src/routes/exciseCompliance.ts:78 — tables: audit_events
- [INSERT apps/api/src/routes/exciseCompliance.ts:80 — tables: excise_rule_pack_audit
- [UPDATE apps/api/src/routes/exciseCompliance.ts:100 — tables: excise_rule_packs
- [INSERT apps/api/src/routes/exciseCompliance.ts:101 — tables: audit_events
- [INSERT apps/api/src/routes/exciseCompliance.ts:103 — tables: excise_rule_pack_audit
- [INSERT apps/api/src/routes/exciseCompliance.ts:123 — tables: outlet_licence_excise_conditions
- [INSERT apps/api/src/routes/exciseCompliance.ts:125 — tables: audit_events
- [UPDATE apps/api/src/routes/exciseCompliance.ts:143 — tables: outlet_licence_excise_conditions
- [INSERT apps/api/src/routes/exciseCompliance.ts:144 — tables: audit_events
- [INSERT apps/api/src/routes/exciseCompliance.ts:155 — tables: excise_dry_day_orders
- [INSERT apps/api/src/routes/exciseCompliance.ts:158 — tables: excise_dry_day_order_audit
- [INSERT apps/api/src/routes/exciseCompliance.ts:181 — tables: excise_dry_day_order_audit
- [INSERT apps/api/src/routes/finance.ts:45 — tables: finance_accounts
- [INSERT apps/api/src/routes/finance.ts:67 — tables: finance_journals
- [INSERT apps/api/src/routes/finance.ts:70 — tables: finance_journal_lines
- [INSERT apps/api/src/routes/financeAutomation.ts:20 — tables: p536_accounting_mappings, SET
- [INSERT apps/api/src/routes/financeAutomation.ts:45 — tables: finance_journals
- [INSERT apps/api/src/routes/financeAutomation.ts:71 — tables: p536_source_postings
- [INSERT apps/api/src/routes/financeAutomation.ts:89 — tables: p578_period_close_checks
- [INSERT apps/api/src/routes/offlineAuthoritative.ts:139 — tables: offline_authoritative_checks
- [INSERT apps/api/src/routes/offlineAuthoritative.ts:142 — tables: offline_sync_audit, offline_sync_events
- [INSERT apps/api/src/routes/offlineLedgerPosting.ts:44 — tables: offline_posting_executions
- [INSERT apps/api/src/routes/offlineLedgerPosting.ts:46 — tables: offline_recovery_cases
- [INSERT apps/api/src/routes/offlineLedgerPosting.ts:52 — tables: offline_recovery_actions
- [INSERT apps/api/src/routes/offlineLedgerPosting.ts:54 — tables: offline_sync_audit
- [INSERT apps/api/src/routes/offlineLedgerPosting.ts:59 — tables: offline_sync_audit
- [INSERT apps/api/src/routes/offlineLedgerPosting.ts:129 — tables: bar_tickets
- [INSERT apps/api/src/routes/offlineLedgerPosting.ts:136 — tables: offline_posting_executions
- [INSERT apps/api/src/routes/offlineLedgerPosting.ts:144 — tables: bar_kot_orders
- [UPDATE apps/api/src/routes/offlineLedgerPosting.ts:152 — tables: open_bottles
- [INSERT apps/api/src/routes/offlineLedgerPosting.ts:153 — tables: peg_transactions
- [INSERT apps/api/src/routes/offlineLedgerPosting.ts:161 — tables: bar_ticket_lines
- [INSERT apps/api/src/routes/offlineLedgerPosting.ts:164 — tables: bar_payments
- [INSERT apps/api/src/routes/offlineLedgerPosting.ts:165 — tables: offline_posting_executions
- [INSERT apps/api/src/routes/offlineLedgerPosting.ts:168 — tables: offline_sync_audit
- [INSERT apps/api/src/routes/offlineLedgerPosting.ts:191 — tables: retail_sales
- [INSERT apps/api/src/routes/offlineLedgerPosting.ts:198 — tables: offline_posting_executions
- [INSERT apps/api/src/routes/offlineLedgerPosting.ts:207 — tables: retail_sale_lines
- [INSERT apps/api/src/routes/offlineLedgerPosting.ts:212 — tables: sale_payments
- [INSERT apps/api/src/routes/offlineLedgerPosting.ts:213 — tables: offline_posting_executions
- [INSERT apps/api/src/routes/offlineLedgerPosting.ts:217 — tables: offline_sync_audit
- [INSERT apps/api/src/routes/offlinePostingApproval.ts:45 — tables: offline_posting_approvals
- [INSERT apps/api/src/routes/offlinePostingApproval.ts:51 — tables: offline_sync_audit, offline_sync_events
- [SELECT apps/api/src/routes/offlineReconciliation.ts:25 — tables: offline_sync_events, offline_sync_batches
- [UPDATE apps/api/src/routes/offlineReconciliation.ts:46 — tables: offline_sync_events
- [INSERT apps/api/src/routes/offlineReconciliation.ts:49 — tables: offline_sync_audit
- [SELECT apps/api/src/routes/offlineReconciliation.ts:52 — tables: offline_sync_events
- [INSERT apps/api/src/routes/offlineRecovery.ts:16 — tables: offline_recovery_actions
- [INSERT apps/api/src/routes/offlineRecovery.ts:18 — tables: offline_sync_audit, offline_sync_events
- [INSERT apps/api/src/routes/offlineRecovery.ts:49 — tables: offline_recovery_cases
- [UPDATE apps/api/src/routes/offlineRecovery.ts:87 — tables: offline_recovery_cases
- [UPDATE apps/api/src/routes/offlineRecovery.ts:109 — tables: offline_recovery_cases
- [UPDATE apps/api/src/routes/offlineRecovery.ts:126 — tables: offline_recovery_cases
- [UPDATE apps/api/src/routes/offlineRecovery.ts:145 — tables: offline_recovery_cases
- [INSERT apps/api/src/routes/offlineSync.ts:70 — tables: offline_sync_batches
- [INSERT apps/api/src/routes/offlineSync.ts:82 — tables: offline_sync_audit
- [INSERT apps/api/src/routes/offlineSync.ts:88 — tables: offline_sync_events
- [INSERT apps/api/src/routes/offlineSync.ts:92 — tables: offline_sync_audit
- [UPDATE apps/api/src/routes/offlineSync.ts:95 — tables: offline_sync_devices
- [INSERT apps/api/src/routes/offlineSync.ts:97 — tables: p580_offline_sync_checkpoints, SET
- [INSERT apps/api/src/routes/offlineSync.ts:102 — tables: offline_sync_audit
- [INSERT apps/api/src/routes/offlineValidation.ts:66 — tables: offline_event_validations
- [INSERT apps/api/src/routes/offlineValidation.ts:69 — tables: offline_posting_intents
- [INSERT apps/api/src/routes/offlineValidation.ts:75 — tables: offline_sync_audit
- [SELECT apps/api/src/routes/offlineValidation.ts:88 — tables: offline_posting_intents, offline_event_validations
- [INSERT apps/api/src/routes/operations.ts:30 — tables: organisations
- [INSERT apps/api/src/routes/operations.ts:48 — tables: outlets
- [INSERT apps/api/src/routes/operations.ts:72 — tables: outlet_licences
- [UPDATE apps/api/src/routes/operations.ts:80 — tables: outlet_licences
- [INSERT apps/api/src/routes/operations.ts:83 — tables: audit_events
- [INSERT apps/api/src/routes/operations.ts:100 — tables: products
- [INSERT apps/api/src/routes/operations.ts:131 — tables: stock_opening_balance_snapshots
- [INSERT apps/api/src/routes/operations.ts:161 — tables: stock_reconciliation_runs
- [INSERT apps/api/src/routes/operations.ts:163 — tables: stock_reconciliation_exceptions
- [INSERT apps/api/src/routes/operations.ts:211 — tables: stock_variance_correction_requests
- [INSERT apps/api/src/routes/operations.ts:286 — tables: inventory_cost_exceptions
- [INSERT apps/api/src/routes/operations.ts:332 — tables: inventory_batches
- [INSERT apps/api/src/routes/operations.ts:338 — tables: inventory_cost_exceptions
- [INSERT apps/api/src/routes/operations.ts:361 — tables: stock_transfers
- [INSERT apps/api/src/routes/operations.ts:464 — tables: outlet_product_prices
- [INSERT apps/api/src/routes/operations.ts:583 — tables: retail_sales
- [INSERT apps/api/src/routes/operations.ts:609 — tables: audit_events
- [SELECT apps/api/src/routes/operations.ts:663 — tables: retail_refund_restock_lines, retail_sale_lines
- [INSERT apps/api/src/routes/operations.ts:689 — tables: open_bottles
- [INSERT apps/api/src/routes/operations.ts:708 — tables: peg_transactions
- [INSERT apps/api/src/routes/operations.ts:735 — tables: bar_bottle_reservations
- [INSERT apps/api/src/routes/operations.ts:737 — tables: audit_events
- [INSERT apps/api/src/routes/operations.ts:748 — tables: audit_events
- [INSERT apps/api/src/routes/operations.ts:776 — tables: outlet_shifts
- [INSERT apps/api/src/routes/operations.ts:819 — tables: shift_events
- [SELECT apps/api/src/routes/organisationAccess.ts:21 — tables: organisations
- [UPDATE apps/api/src/routes/organisationAccess.ts:32 — tables: organisations
- [INSERT apps/api/src/routes/organisationAccess.ts:34 — tables: audit_events
- [INSERT apps/api/src/routes/organisationAccess.ts:63 — tables: organisation_invitations
- [INSERT apps/api/src/routes/organisationAccess.ts:65 — tables: audit_events
- [SELECT apps/api/src/routes/organisationAccess.ts:78 — tables: organisation_invitations
- [INSERT apps/api/src/routes/organisationAccess.ts:93 — tables: users
- [INSERT apps/api/src/routes/organisationAccess.ts:96 — tables: organisation_memberships, SET
- [INSERT apps/api/src/routes/organisationAccess.ts:98 — tables: audit_events
- [INSERT apps/api/src/routes/organisationAccess.ts:122 — tables: audit_events
- [INSERT apps/api/src/routes/organisationAccess.ts:139 — tables: audit_events
- [INSERT apps/api/src/routes/paymentLifecycle.ts:19 — tables: p535_provider_events
- [INSERT apps/api/src/routes/paymentLifecycle.ts:28 — tables: p535_cash_counts, SET
- [INSERT apps/api/src/routes/paymentLifecycle.ts:29 — tables: shift_events
- [SELECT apps/api/src/routes/paymentLifecycle.ts:32 — tables: p535_provider_events
- [INSERT apps/api/src/routes/paymentLifecycle.ts:35 — tables: p535_settlement_batches
- [INSERT apps/api/src/routes/paymentLifecycle.ts:35 — tables: p535_settlement_items
- [INSERT apps/api/src/routes/paymentLifecycle.ts:43 — tables: p535_tender_allocations
- [SELECT apps/api/src/routes/paymentLifecycle.ts:47 — tables: p535_settlement_items
- [UPDATE apps/api/src/routes/paymentLifecycle.ts:47 — tables: p535_settlement_items
- [UPDATE apps/api/src/routes/paymentLifecycle.ts:47 — tables: p535_tender_allocations
- [UPDATE apps/api/src/routes/paymentLifecycle.ts:47 — tables: p535_settlement_items
- [INSERT apps/api/src/routes/paymentLifecycle.ts:47 — tables: p535_payment_exceptions
- [SELECT apps/api/src/routes/paymentLifecycle.ts:47 — tables: p535_settlement_items
- [UPDATE apps/api/src/routes/paymentLifecycle.ts:47 — tables: p535_settlement_batches
- [INSERT apps/api/src/routes/paymentLifecycle.ts:49 — tables: p535_payment_exceptions
- [UPDATE apps/api/src/routes/paymentLifecycle.ts:49 — tables: p535_settlement_batches
- [INSERT apps/api/src/routes/paymentReconciliation.ts:17 — tables: payment_reconciliation_batches
- [INSERT apps/api/src/routes/paymentReconciliation.ts:18 — tables: payment_reconciliation_lines
- [SELECT apps/api/src/routes/paymentReconciliation.ts:25 — tables: payment_reconciliation_lines
- [UPDATE apps/api/src/routes/paymentReconciliation.ts:26 — tables: payment_reconciliation_lines
- [UPDATE apps/api/src/routes/paymentReconciliation.ts:26 — tables: payment_reconciliation_lines
- [SELECT apps/api/src/routes/paymentReconciliation.ts:27 — tables: payment_reconciliation_lines
- [UPDATE apps/api/src/routes/paymentReconciliation.ts:27 — tables: payment_reconciliation_batches
- [INSERT apps/api/src/routes/procurement.ts:18 — tables: procurement_audit_events
- [INSERT apps/api/src/routes/procurement.ts:29 — tables: suppliers
- [INSERT apps/api/src/routes/procurement.ts:30 — tables: procurement_audit_events
- [INSERT apps/api/src/routes/procurement.ts:49 — tables: supplier_returns
- [INSERT apps/api/src/routes/procurement.ts:54 — tables: supplier_return_lines
- [UPDATE apps/api/src/routes/procurement.ts:73 — tables: supplier_returns
- [INSERT apps/api/src/routes/procurement.ts:90 — tables: supplier_return_movements
- [UPDATE apps/api/src/routes/procurement.ts:93 — tables: supplier_returns
- [INSERT apps/api/src/routes/procurement.ts:108 — tables: purchase_orders
- [INSERT apps/api/src/routes/procurement.ts:130 — tables: goods_receipts
- [INSERT apps/api/src/routes/procurement.ts:132 — tables: goods_receipt_lines
- [INSERT apps/api/src/routes/regulatoryReports.ts:28 — tables: p579_regulatory_report_runs
- [SELECT apps/api/src/routes/regulatoryReports.ts:44 — tables: p579_product_traceability_links, products
- [INSERT apps/api/src/routes/reportGovernance.ts:14 — tables: p581_saved_reports, SET
- [INSERT apps/api/src/routes/reportGovernance.ts:17 — tables: p581_report_execution_evidence
- [INSERT apps/api/src/routes/settlements.ts:30 — tables: p577_bank_statement_lines
- [INSERT apps/api/src/routes/settlements.ts:70 — tables: p577_chargeback_cases
- [INSERT apps/api/src/routes/settlements.ts:102 — tables: retail_refunds
- [INSERT apps/api/src/routes/settlements.ts:114 — tables: retail_refund_restock_lines
- [INSERT apps/api/src/routes/settlements.ts:115 — tables: stock_balances, SET
- [INSERT apps/api/src/routes/settlements.ts:122 — tables: audit_events
- [INSERT apps/api/src/routes/settlements.ts:143 — tables: bar_refunds
- [SELECT apps/api/src/routes/settlements.ts:145 — tables: bar_ticket_lines
- [INSERT apps/api/src/routes/settlements.ts:154 — tables: bar_refund_peg_restorations
- [INSERT apps/api/src/routes/settlements.ts:155 — tables: peg_transactions
- [UPDATE apps/api/src/routes/settlements.ts:158 — tables: bar_tickets
- [INSERT apps/api/src/routes/settlements.ts:159 — tables: audit_events
- [UPDATE apps/api/src/routes/settlements.ts:213 — tables: bar_refund_peg_restorations
- [INSERT apps/api/src/routes/settlements.ts:219 — tables: audit_events
- [INSERT apps/api/src/routes/settlements.ts:239 — tables: shift_cash_movements
- [INSERT apps/api/src/routes/settlements.ts:240 — tables: shift_events
- [SELECT apps/api/src/routes/taxPricing.ts:12 — tables: tax_rule_packs, tax_rule_components
- [INSERT apps/api/src/routes/taxPricing.ts:13 — tables: tax_rule_packs
- [INSERT apps/api/src/routes/taxPricing.ts:15 — tables: tax_rule_components
- [UPDATE apps/api/src/routes/taxPricing.ts:17 — tables: tax_rule_packs
- [SELECT apps/api/src/routes/taxPricing.ts:18 — tables: tax_rule_components
- [INSERT apps/api/src/routes/taxPricing.ts:20 — tables: tax_product_profiles
- [INSERT apps/api/src/routes/taxPricing.ts:24 — tables: outlet_tax_prices
- [INSERT apps/api/src/routes/taxPricing.ts:28 — tables: tax_calculation_snapshots
- [INSERT apps/api/src/routes/tradePortal.ts:29 — tables: trade_partner_profiles, SET
- [SELECT apps/api/src/routes/tradePortal.ts:59 — tables: organisations
- [INSERT apps/api/src/routes/tradePortal.ts:61 — tables: trade_relationships, SET
- [UPDATE apps/api/src/routes/tradePortal.ts:72 — tables: trade_relationships
- [SELECT apps/api/src/routes/tradePortal.ts:80 — tables: trade_relationships, organisations
- [INSERT apps/api/src/routes/tradePortal.ts:97 — tables: trade_catalogue_items, SET
- [SELECT apps/api/src/routes/tradePortal.ts:111 — tables: trade_catalogue_items, products
- [SELECT apps/api/src/routes/tradePortal.ts:130 — tables: trade_catalogue_items, products
- [INSERT apps/api/src/routes/tradePortal.ts:138 — tables: trade_orders
- [INSERT apps/api/src/routes/tradePortal.ts:141 — tables: trade_order_lines
- [SELECT apps/api/src/routes/tradePortal.ts:166 — tables: trade_orders, organisations
- [SELECT apps/api/src/routes/tradePortal.ts:186 — tables: trade_orders
- [INSERT apps/api/src/routes/tradePortal.ts:197 — tables: trade_order_fulfilment_events
- [SELECT apps/api/src/routes/tradePortal.ts:208 — tables: trade_order_fulfilment_events
- [SELECT apps/api/src/services/exciseCompliance.ts:46 — tables: excise_rule_packs
- [SELECT apps/api/src/services/exciseCompliance.ts:85 — tables: excise_dry_day_orders
- [INSERT apps/api/src/services/exciseCompliance.ts:93 — tables: excise_compliance_decisions
- [INSERT apps/api/src/services/inventoryCosting.ts:35 — tables: inventory_cost_consumptions
- [INSERT apps/api/src/services/inventoryCosting.ts:40 — tables: inventory_cost_consumption_events
- [INSERT apps/api/src/services/inventoryCosting.ts:44 — tables: inventory_cost_exceptions
- [INSERT apps/api/src/services/inventoryCosting.ts:57 — tables: inventory_cost_layers
- [INSERT apps/api/src/services/stockMovementIdempotency.ts:50 — tables: stock_movements
- [INSERT apps/api/src/services/taxQuote.ts:39 — tables: tax_calculation_attempts
- [SELECT apps/api/src/services/taxQuote.ts:50 — tables: tax_rule_packs
- [INSERT apps/api/src/services/taxQuote.ts:54 — tables: tax_calculation_attempts
- [SELECT apps/api/src/services/taxQuote.ts:59 — tables: tax_rule_components
- [INSERT apps/api/src/services/taxQuote.ts:68 — tables: tax_calculation_snapshots
- [INSERT apps/api/src/services/taxQuote.ts:72 — tables: tax_calculation_attempts
