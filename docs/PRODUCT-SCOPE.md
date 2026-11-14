# Product Scope — Alcohol Retail + Peg Bar + Brand Connect

## Product operating profiles
- Retail-only: packaged liquor sales; no on-premise consumption features.
- Bar-only: licensed on-premise sales including configured peg/nip/bottle measures.
- Hybrid: separately configured retail and bar operations, only where the outlet's verified licences permit both.

A software configuration must never create or imply legal permission. Outlet capabilities are gated by reviewed licence evidence and jurisdiction-specific policy.

## Applications
1. Platform Super Admin
2. Retailer Admin and Retail POS
3. Bar Admin and Bar POS
4. Brand Portal
5. Distributor Portal
6. Trade Partner App
7. Consumer Experience (only legally approved functionality)

## Core requirements
- Offline-first retail/bar POS with durable outbox and idempotent sync.
- Shared product catalogue, but separate retail/bar transaction types.
- Immutable stock movement ledger.
- Sealed bottle stock and open-bottle remaining volume in ml.
- Peg measure configuration by product and bottle size.
- Cash/UPI/card reconciliation.
- Multi-outlet hierarchy and role-scoped dashboards.
- Brand programmes with partner eligibility, approval, benefit ledger and audited settlement.
- Distributor/field-sales territory and visit workflows.
- Privacy-aware, aggregated brand analytics.
- AI remains feature-flagged off in the initial release.
