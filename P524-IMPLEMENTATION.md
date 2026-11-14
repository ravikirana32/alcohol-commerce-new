# P524 — Mobile, Offline and Hardware Integration

**Release:** 0.524.0-dev  
**Baseline:** P523 cumulative  
**Status:** PARTIAL — developer preview; not production approved

## Delivered
- Added an authenticated-workspace navigation entry for Offline & Devices.
- Added a responsive device centre showing browser online/offline state and local IndexedDB event counts.
- Added durable local storage for non-financial diagnostic events, with refresh and pending-state visibility.
- Added keyboard-wedge barcode scanner capture (input + Enter) without triggering product lookup or checkout.
- Added a browser print-dialog hand-off for receipt-printer configuration.
- Added explicit guardrail messaging: this diagnostic queue does not authorise, synchronise or settle sales, payments, alcohol transactions or stock movements.

## Existing foundations reused
- Existing offline queue/envelope/order-validation helpers and device/offline API services remain in the cumulative codebase. P524 does not claim that all those legacy services are wired into a complete client-to-server sync lifecycle.

## Not delivered / limitations
- No Expo/React Native mobile application or signed native builds.
- No production sale queue, server sync endpoint integration, retry scheduler, idempotent replay or conflict-resolution UI.
- No background sync guarantee; browser storage may be evicted and private browsing may restrict IndexedDB.
- No native camera scanner, Bluetooth scanner pairing, ESC/POS transport, network printer discovery, kitchen printer routing or cash-drawer kick.
- No device enrollment/trust UI, remote revocation or hardware fleet management.
- No stock receiving/count workflow on mobile.
- No PostgreSQL/API/browser/mobile/hardware runtime E2E in this phase.

## Security and business constraints
Offline financial transactions must remain disabled until server-side idempotency, device trust, tenant/outlet scope, signed event provenance, conflict policy, legal eligibility, reconciliation and recovery tests are implemented. Alcohol transaction permissions remain subject to applicable state excise and licensing requirements.
