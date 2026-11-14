# P559 SQL Tenant Predicate Audit

- TypeScript files scanned: 228
- Direct query template literals inspected: 382
- Statements with explicit organisation predicate: 122
- Outlet-only predicate: 8
- Manual review required: 252
- Mutation statements: 237

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
- [INSERT apps/api/src/routes/auth.ts:63 — tables: users
- [SELECT apps/api/src/routes/auth.ts:83 — tables: users
- [SELECT apps/api/src/routes/auth.ts:96 — tables: organisation_memberships
- [SELECT apps/api/src/routes/barCheckout.ts:82 — tables: bar_refund_peg_restorations, bar_ticket_lines
- [INSERT apps/api/src/routes/barCheckout.ts:122 — tables: bar_table_sessions
- [INSERT apps/api/src/routes/barCheckout.ts:127 — tables: audit_events
- [INSERT apps/api/src/routes/barCheckout.ts:149 — tables: audit_events
- [INSERT apps/api/src/routes/barCheckout.ts:174 — tables: audit_events
- [INSERT apps/api/src/routes/barCheckout.ts:192 — tables: audit_events
- [UPDATE apps/api/src/routes/barCheckout.ts:227 — tables: bar_kot_orders
- [INSERT apps/api/src/routes/barCheckout.ts:228 — tables: audit_events
- [INSERT apps/api/src/routes/barCheckout.ts:315 — tables: bar_tickets
- [INSERT apps/api/src/routes/barCheckout.ts:322 — tables: bar_kot_orders
- [UPDATE apps/api/src/routes/barCheckout.ts:348 — tables: open_bottles
- [INSERT apps/api/src/routes/barCheckout.ts:353 — tables: peg_transactions
- [INSERT apps/api/src/routes/barCheckout.ts:373 — tables: stock_movements
- [INSERT apps/api/src/routes/barCheckout.ts:379 — tables: bar_ticket_lines
- [INSERT apps/api/src/routes/barCheckout.ts:394 — tables: audit_events
- [INSERT apps/api/src/routes/catalogue.ts:20 — tables: product_categories
- [INSERT apps/api/src/routes/devices.ts:28 — tables: pos_devices, SET
- [INSERT apps/api/src/routes/devices.ts:45 — tables: pos_device_challenges
- [SELECT apps/api/src/routes/devices.ts:58 — tables: pos_device_challenges
- [INSERT apps/api/src/routes/ecosystem.ts:24 — tables: outlet_transfers
- [INSERT apps/api/src/routes/ecosystem.ts:31 — tables: stock_movements
- [INSERT apps/api/src/routes/ecosystem.ts:50 — tables: stock_balances, SET
- [INSERT apps/api/src/routes/ecosystem.ts:53 — tables: stock_movements
- [INSERT apps/api/src/routes/ecosystem.ts:66 — tables: expenses
- [INSERT apps/api/src/routes/ecosystem.ts:81 — tables: accounting_exports
- [INSERT apps/api/src/routes/ecosystem.ts:89 — tables: customers, SET
- [INSERT apps/api/src/routes/ecosystem.ts:99 — tables: customer_consents
- [INSERT apps/api/src/routes/ecosystem.ts:138 — tables: distributor_outlet_assignments, SET
- [INSERT apps/api/src/routes/ecosystem.ts:168 — tables: trade_scheme_participants, SET
- [INSERT apps/api/src/routes/ecosystem.ts:186 — tables: field_visits
- [INSERT apps/api/src/routes/ecosystem.ts:200 — tables: consumer_discovery_settings, SET
- [INSERT apps/api/src/routes/ecosystem.ts:209 — tables: consumer_public_listings
- [INSERT apps/api/src/routes/ecosystem.ts:252 — tables: device_registrations
- [INSERT apps/api/src/routes/ecosystem.ts:268 — tables: sync_batches
- [INSERT apps/api/src/routes/ecosystem.ts:291 — tables: release_checks, SET
- [INSERT apps/api/src/routes/enterpriseIntegrations.ts:16 — tables: security_audit_events
- [INSERT apps/api/src/routes/enterpriseIntegrations.ts:33 — tables: enterprise_integrations
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
- [UPDATE apps/api/src/routes/finance.ts:72 — tables: finance_journals
- [INSERT apps/api/src/routes/financeAutomation.ts:20 — tables: p536_accounting_mappings, SET
- [INSERT apps/api/src/routes/financeAutomation.ts:42 — tables: finance_journals
- [INSERT apps/api/src/routes/financeAutomation.ts:68 — tables: p536_source_postings
- [INSERT apps/api/src/routes/offlineAuthoritative.ts:139 — tables: offline_authoritative_checks
- [INSERT apps/api/src/routes/offlineAuthoritative.ts:142 — tables: offline_sync_audit, offline_sync_events
- [INSERT apps/api/src/routes/offlineLedgerPosting.ts:43 — tables: offline_posting_executions
- [INSERT apps/api/src/routes/offlineLedgerPosting.ts:45 — tables: offline_recovery_cases
- [INSERT apps/api/src/routes/offlineLedgerPosting.ts:51 — tables: offline_recovery_actions
- [INSERT apps/api/src/routes/offlineLedgerPosting.ts:53 — tables: offline_sync_audit
- [INSERT apps/api/src/routes/offlineLedgerPosting.ts:58 — tables: offline_sync_audit
- [INSERT apps/api/src/routes/offlineLedgerPosting.ts:128 — tables: bar_tickets
- [INSERT apps/api/src/routes/offlineLedgerPosting.ts:135 — tables: offline_posting_executions
- [INSERT apps/api/src/routes/offlineLedgerPosting.ts:143 — tables: bar_kot_orders
- [UPDATE apps/api/src/routes/offlineLedgerPosting.ts:151 — tables: open_bottles
- [INSERT apps/api/src/routes/offlineLedgerPosting.ts:152 — tables: peg_transactions
- [INSERT apps/api/src/routes/offlineLedgerPosting.ts:158 — tables: stock_movements
- [INSERT apps/api/src/routes/offlineLedgerPosting.ts:160 — tables: bar_ticket_lines
- [INSERT apps/api/src/routes/offlineLedgerPosting.ts:163 — tables: bar_payments
- [INSERT apps/api/src/routes/offlineLedgerPosting.ts:164 — tables: offline_posting_executions
- [INSERT apps/api/src/routes/offlineLedgerPosting.ts:167 — tables: offline_sync_audit
- [INSERT apps/api/src/routes/offlineLedgerPosting.ts:190 — tables: retail_sales
- [INSERT apps/api/src/routes/offlineLedgerPosting.ts:197 — tables: offline_posting_executions
- [INSERT apps/api/src/routes/offlineLedgerPosting.ts:206 — tables: retail_sale_lines
- [INSERT apps/api/src/routes/offlineLedgerPosting.ts:209 — tables: stock_movements
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
- [UPDATE apps/api/src/routes/offlineRecovery.ts:70 — tables: offline_recovery_cases
- [UPDATE apps/api/src/routes/offlineRecovery.ts:87 — tables: offline_recovery_cases
- [UPDATE apps/api/src/routes/offlineRecovery.ts:109 — tables: offline_recovery_cases
- [UPDATE apps/api/src/routes/offlineRecovery.ts:126 — tables: offline_recovery_cases
- [UPDATE apps/api/src/routes/offlineRecovery.ts:145 — tables: offline_recovery_cases
- [INSERT apps/api/src/routes/offlineSync.ts:70 — tables: offline_sync_batches
- [INSERT apps/api/src/routes/offlineSync.ts:82 — tables: offline_sync_audit
- [INSERT apps/api/src/routes/offlineSync.ts:88 — tables: offline_sync_events
- [INSERT apps/api/src/routes/offlineSync.ts:92 — tables: offline_sync_audit
- [UPDATE apps/api/src/routes/offlineSync.ts:95 — tables: offline_sync_devices
- [INSERT apps/api/src/routes/offlineSync.ts:96 — tables: offline_sync_audit
- [INSERT apps/api/src/routes/offlineValidation.ts:66 — tables: offline_event_validations
- [INSERT apps/api/src/routes/offlineValidation.ts:69 — tables: offline_posting_intents
- [INSERT apps/api/src/routes/offlineValidation.ts:75 — tables: offline_sync_audit
- [SELECT apps/api/src/routes/offlineValidation.ts:88 — tables: offline_posting_intents, offline_event_validations
- [INSERT apps/api/src/routes/operations.ts:26 — tables: organisations
- [INSERT apps/api/src/routes/operations.ts:44 — tables: outlets
- [INSERT apps/api/src/routes/operations.ts:68 — tables: outlet_licences
- [UPDATE apps/api/src/routes/operations.ts:76 — tables: outlet_licences
- [INSERT apps/api/src/routes/operations.ts:79 — tables: audit_events
- [INSERT apps/api/src/routes/operations.ts:96 — tables: products
- [INSERT apps/api/src/routes/operations.ts:125 — tables: stock_balances, SET
- [INSERT apps/api/src/routes/operations.ts:128 — tables: stock_movements
- [INSERT apps/api/src/routes/operations.ts:146 — tables: stock_balances, SET
- [INSERT apps/api/src/routes/operations.ts:148 — tables: stock_movements
- [INSERT apps/api/src/routes/operations.ts:168 — tables: inventory_batches
- [INSERT apps/api/src/routes/operations.ts:170 — tables: stock_balances, SET
- [INSERT apps/api/src/routes/operations.ts:193 — tables: stock_transfers
- [INSERT apps/api/src/routes/operations.ts:230 — tables: stock_balances, SET
- [INSERT apps/api/src/routes/operations.ts:267 — tables: stock_balances, SET
- [INSERT apps/api/src/routes/operations.ts:296 — tables: outlet_product_prices
- [INSERT apps/api/src/routes/operations.ts:415 — tables: retail_sales
- [INSERT apps/api/src/routes/operations.ts:432 — tables: stock_movements
- [INSERT apps/api/src/routes/operations.ts:444 — tables: audit_events
- [SELECT apps/api/src/routes/operations.ts:498 — tables: retail_refund_restock_lines, retail_sale_lines
- [INSERT apps/api/src/routes/operations.ts:520 — tables: stock_movements
- [INSERT apps/api/src/routes/operations.ts:522 — tables: open_bottles
- [INSERT apps/api/src/routes/operations.ts:541 — tables: peg_transactions
- [INSERT apps/api/src/routes/operations.ts:568 — tables: bar_bottle_reservations
- [INSERT apps/api/src/routes/operations.ts:570 — tables: audit_events
- [INSERT apps/api/src/routes/operations.ts:581 — tables: audit_events
- [INSERT apps/api/src/routes/operations.ts:609 — tables: outlet_shifts
- [SELECT apps/api/src/routes/operations.ts:627 — tables: shift_cash_movements
- [SELECT apps/api/src/routes/operations.ts:646 — tables: shift_cash_movements
- [UPDATE apps/api/src/routes/operations.ts:650 — tables: outlet_shifts
- [INSERT apps/api/src/routes/operations.ts:652 — tables: shift_events
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
- [INSERT apps/api/src/routes/procurement.ts:15 — tables: procurement_audit_events
- [INSERT apps/api/src/routes/procurement.ts:26 — tables: suppliers
- [INSERT apps/api/src/routes/procurement.ts:27 — tables: procurement_audit_events
- [INSERT apps/api/src/routes/procurement.ts:46 — tables: purchase_orders
- [INSERT apps/api/src/routes/procurement.ts:53 — tables: purchase_order_approvals, SET
- [UPDATE apps/api/src/routes/procurement.ts:57 — tables: purchase_order_approvals
- [INSERT apps/api/src/routes/procurement.ts:64 — tables: goods_receipts
- [SELECT apps/api/src/routes/procurement.ts:65 — tables: purchase_order_lines, products
- [INSERT apps/api/src/routes/procurement.ts:66 — tables: goods_receipt_lines
- [UPDATE apps/api/src/routes/procurement.ts:67 — tables: purchase_order_lines
- [INSERT apps/api/src/routes/procurement.ts:68 — tables: stock_balances, SET
- [INSERT apps/api/src/routes/procurement.ts:68 — tables: stock_movements
- [INSERT apps/api/src/routes/procurement.ts:69 — tables: inventory_batches, SET
- [UPDATE apps/api/src/routes/procurement.ts:71 — tables: goods_receipts
- [SELECT apps/api/src/routes/procurement.ts:71 — tables: purchase_order_lines
- [UPDATE apps/api/src/routes/procurement.ts:71 — tables: purchase_orders
- [INSERT apps/api/src/routes/settlements.ts:25 — tables: retail_refunds
- [INSERT apps/api/src/routes/settlements.ts:37 — tables: retail_refund_restock_lines
- [INSERT apps/api/src/routes/settlements.ts:38 — tables: stock_balances, SET
- [INSERT apps/api/src/routes/settlements.ts:39 — tables: stock_movements
- [UPDATE apps/api/src/routes/settlements.ts:43 — tables: retail_sales
- [INSERT apps/api/src/routes/settlements.ts:44 — tables: audit_events
- [INSERT apps/api/src/routes/settlements.ts:61 — tables: bar_refunds
- [SELECT apps/api/src/routes/settlements.ts:63 — tables: bar_ticket_lines
- [INSERT apps/api/src/routes/settlements.ts:72 — tables: bar_refund_peg_restorations
- [INSERT apps/api/src/routes/settlements.ts:73 — tables: peg_transactions
- [UPDATE apps/api/src/routes/settlements.ts:76 — tables: bar_tickets
- [INSERT apps/api/src/routes/settlements.ts:77 — tables: audit_events
- [UPDATE apps/api/src/routes/settlements.ts:131 — tables: bar_refund_peg_restorations
- [INSERT apps/api/src/routes/settlements.ts:137 — tables: audit_events
- [INSERT apps/api/src/routes/settlements.ts:157 — tables: shift_cash_movements
- [INSERT apps/api/src/routes/settlements.ts:158 — tables: shift_events
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
- [INSERT apps/api/src/services/taxQuote.ts:39 — tables: tax_calculation_attempts
- [SELECT apps/api/src/services/taxQuote.ts:50 — tables: tax_rule_packs
- [INSERT apps/api/src/services/taxQuote.ts:54 — tables: tax_calculation_attempts
- [SELECT apps/api/src/services/taxQuote.ts:59 — tables: tax_rule_components
