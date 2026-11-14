# Architecture — Initial Foundation

## Proposed stack
- React + Vite + TypeScript web portals.
- React Native + Expo mobile apps (later milestone).
- Node.js + Express + TypeScript API.
- PostgreSQL as transactional source of truth.
- Redis for caching and background jobs.
- Socket.IO for realtime updates when required.
- IndexedDB (web) and SQLite (mobile) for offline operation.
- Docker Compose for local development; CI/CD and managed infrastructure for production.

## Architecture style
Start with a modular monolith with bounded modules:
- identity/access
- organisations/outlets/licences
- catalogue/pricing
- retail POS
- bar POS/peg engine
- inventory ledger
- purchases/suppliers
- payments/settlement
- brand programmes
- distributor/field execution
- trade engagement
- reporting/analytics
- offline sync
- audit/notifications

Extract services only when scale, deployment isolation or team ownership justifies it.

## Critical invariants
1. Every tenant-owned record must be scoped to organisation/outlet through trusted server-side identity context.
2. Client-supplied tenant IDs must never be trusted as authorisation.
3. Inventory and financial writes must be transactional and idempotent.
4. Every stock movement must be append-only/auditable; corrections are compensating movements.
5. Bar peg sales deduct exact configured ml and reference a stock lot/open bottle where feasible.
6. Offline sync uses unique operation IDs and deterministic conflict handling.
7. Brands see only their own programme data and authorised aggregates.
8. Consumer personal data is not shared with brands by default.
