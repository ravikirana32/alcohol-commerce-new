# Alcohol Commerce Platform — P531 cumulative developer preview

Cumulative source: P530 cumulative baseline plus P531 measure-aware offline bar checkout, open-bottle depletion, bottle reservations and wastage/breakage controls. Version `0.531.0-dev`.

This cumulative package retains the earlier organisation/access, catalogue, retail/bar POS, inventory, procurement, finance/reporting, trade portal, device and offline reconciliation foundations. P531 extends the approved offline posting chain to BAR_CHECKOUT with atomic peg/bottle/packaged inventory effects. It remains a **developer preview**, not a production-approved system. Key P531 work:
- exact peg millilitre depletion from a scoped open bottle;
- bottle and packaged stock movements, bar ticket lines and KOT;
- reservation-aware available volume, expiry and release controls;
- measured wastage, breakage, complimentary and adjustment deductions;
- offline bar payment evidence marked `RECORDED_OFFLINE`, not settled;
- role-gated operator UI and posting audit trail.

Historical P515 foundation notes follow:
- organisation profile management;
- category and brand management, product lifecycle, variants, JSON bulk import/export, outlet price history and catalogue UI;
- outlet creation/listing and licence record submission;
- one-time, hashed and expiring staff invitations;
- membership role/status management and outlet assignments;
- outlet assignment enforcement for retail/bar checkout;
- aligned root/API/web package versions and displayed version;
- startup validation for required environment configuration and API port;
- cryptographically generated request correlation IDs and response correlation headers;
- request draining during shutdown and database pool cleanup;
- readiness reflects draining state;
- static integration audit and explicit release-gate policy checks.

**NOT PRODUCTION READY / NOT APPROVED.** Many domain policy modules remain unreferenced by API workflows, and the web application is still a limited development workspace. PostgreSQL execution, full dependency installation, complete typecheck/build, API/browser E2E, provider certification, independent security assessment, Karnataka excise/legal approval and an authorised outlet pilot are not implied.

Run from this directory:
```bash
npm install
npm run audit:integration
npm run verify:release-gate
npm run verify:retail-checkout
npm run verify:cumulative
npm run verify:p401-p450
npm run check:syntax
npm run typecheck
npm test
npm run build
```

AI remains disabled by default. Consumer alcohol transactions must be gated by verified licence permissions and applicable law. See `P513-IMPLEMENTATION.md`, `P514-IMPLEMENTATION.md`, `P515-IMPLEMENTATION.md`, `P515-RUNBOOK.md`, `P515-TEST-REPORT.md` and `docs/PHASE-STATUS-P513-P526.md`.


## P500.2 retail checkout integrity remediation

- Added a persisted SHA-256 checkout request fingerprint to retail sales.
- Reusing an idempotency key with a different semantic request now returns HTTP 409.
- Legacy sales without a stored fingerprint are compared against their recorded lines and tenders on first replay, then backfilled.
- Retail sale totals use integer minor-unit arithmetic with per-line tax rounding.
- Stock deductions are tenant-scoped and guarded by a non-negative balance condition.
- Retail checkout now writes an audit event and exposes a scoped sale-detail endpoint.
- Added unit tests for canonical fingerprints, amount arithmetic and quantity precision.

Apply database migrations before running this code:
```bash
npm run db:migrate
```


## P500.3 retail cart UI integration

The retail POS screen now supports multi-line cart construction, quantity aggregation, line removal and atomic checkout of all cart lines. It preserves the exact pending request/idempotency key for safe retries after uncertain network responses. Bar POS remains a single-line UI. See `P500.3-RETAIL-CART-UI-INTEGRATION.md` and `P500.3-IMPLEMENTATION-STATUS.md`.


## P500.4 — Retail split tender and receipt

Retail and bar POS now allow multiple tender allocations across cash, UPI, card, wallet and other methods. The UI checks the tender sum against the displayed checkout total before sending the checkout request. A receipt preview with item/tender breakdown and browser print styling is shown after a successful response. This is not a certified fiscal receipt printer integration.


## P500.5 — Shift management

Added Shift Management navigation and UI for opening a shift, recording cash-in/cash-out movements, reviewing retail/bar cash tender totals and expected cash, entering declared cash and closing the shift with a displayed variance. API adds a current-open-shift lookup and enriches shift preview. Runtime/database verification remains pending.


## P500.6 — Retail sales history and refunds

Added the Sales & Refunds workspace. Staff with the required API permission can review outlet sales, inspect lines/tenders/refund history and submit a refund with reason, method, reference and optional restock. The backend already enforces the remaining refundable balance and audits the refund. Restock remains proportional by refund value; item-level return allocation is a known gap.


## P500.7 — Bar multi-line tickets

Bar POS now supports a multi-line ticket containing PEG, BOTTLE and PACKAGED items. Peg lines retain the selected open bottle and measure; all lines and split tenders are submitted to the atomic checkout endpoint. Migration 212 adds a canonical bar checkout request fingerprint so an idempotency key cannot replay a different ticket payload.


## P500.8 — Bar ticket history and refunds

Added organisation-scoped bar ticket list/detail endpoints, ticket line/payment/refund detail, and `bar:read` role permissions. The Bar Tickets & Refunds workspace lets authorised users review tickets and submit capped refunds. Refunds do not automatically replenish open-bottle ml; a separate authorised physical stock adjustment remains required.


## P500.9 — Inventory operations

Added Inventory Control with outlet stock balances, product selection, stock receipts and reason-coded positive/negative adjustments. Existing API transactions write stock movement records and reject adjustments that would create negative stock. Supplier purchase orders, invoice matching, stocktake and AP integration remain future work.


## P501 — Integration baseline

P501 integrates the current retail, bar, refunds, shift and inventory workspaces into a single developer-preview baseline. It adds the unified `npm run verify:p501` deterministic check, hardens legacy bar idempotency race replay and improves POS recovery after definitive 4xx versus uncertain transport/5xx failures. See `P501-RELEASE-READINESS.md` for mandatory runtime, security, legal and pilot gates.


## P502 — SKU-level refund allocations and bar peg-return quarantine

Retail refunds now require explicit SKU/quantity allocations for restocking, and bar peg-return volume is tracked against the original ticket line with returned liquid quarantined rather than returned to saleable stock. See `P502-IMPLEMENTATION.md`.

## P503 — Quarantine disposition controls

Added an organisation-scoped quarantine queue and manager-authorised disposition workflow with reason, compliance reference, actor/time audit and database protections. See `P503-RELEASE-READINESS.md`.

## P504 — Docker one-command local stack

Run the complete local development stack (PostgreSQL, Redis, migrations, API and web UI):

- Windows PowerShell: `\scripts\start.ps1`
- macOS/Linux: `./scripts/start.sh`

See `docs/DOCKER-QUICKSTART.md` for prerequisites, first-admin bootstrap, stop/log commands and troubleshooting. The Docker stack is for local development only; it is not a production deployment.

Remaining phases and exit criteria are in `docs/REMAINING-PHASE-ROADMAP-P504-P512.md`.


## Current release: P513 (partial)

P513 establishes a single generated application version, API metadata endpoint, consistent request error responses, and repaired P510/P511 verifier command wiring. Run `npm run version:sync` followed by `npm run verify:p513`. The phase is not release-complete until a clean dependency installation, API/web typechecks, production builds and runtime integration tests pass. See `P513-IMPLEMENTATION.md` and `P513-TEST-REPORT.md`.


## Current cumulative gap register
See `P513-P528-Cumulative-Gap-Register.docx` and `P513-ONWARD-GAP-REGISTER.md`. Update both at every subsequent phase.


## Current cumulative gap register
The current editable register is `P513-P528-Cumulative-Gap-Register.docx`; its Markdown source is `P513-ONWARD-GAP-REGISTER.md`. This register must be updated and included with every subsequent phase release.

## P524 — Offline & Devices
The P524 device centre is available from **Offline & Devices** after login. It demonstrates browser connectivity, IndexedDB diagnostic-event persistence, keyboard-wedge barcode capture and browser print hand-off. It does not implement offline sale replay, native mobile builds, ESC/POS, cash-drawer control or production hardware management. See `P524-IMPLEMENTATION.md`, `P524-RUNBOOK.md`, `P524-STATUS.md`, and the cumulative gap register.


## P525 — Offline sync intake and reconciliation ledger
P525 adds organisation/outlet-scoped device enrolment and revocation, bounded sync-batch intake, payload hashing, idempotent batch replay, per-device event/sequence deduplication, conflict classification, and audit records. Financial and stock-affecting events are persisted as `REVIEW_REQUIRED`; this intake API does not post sales, tenders, stock movements, or journals. See `P525-IMPLEMENTATION.md`, `P525-RUNBOOK.md`, and `P525-STATUS.md`.


## Latest phase

P526 (`0.526.0-dev`) adds offline event reconciliation review with maker-checker controls. Approvals are `APPROVED_NO_POST`; no financial or inventory ledger posting is enabled. See `P526-IMPLEMENTATION.md`, `P526-RUNBOOK.md`, and `P526-STATUS.md`.


P527 (`0.527.0-dev`) adds offline event validation evidence and durable posting intents. `READY_FOR_POST` is an intent only; P527 does not mutate sales, payments, stock or accounting ledgers. See `P527-IMPLEMENTATION.md`, `P527-RUNBOOK.md`, and `P527-STATUS.md`.


## P528 — Authoritative Offline Validation

P528 adds current organisation/outlet, licence/capability, product, outlet-price, retail-stock and payment-allocation checks for validated offline posting intents. Failed checks are held and immutable evidence is audited. Bar measure-aware stock validation intentionally fails closed. Even a passing check does not post any sale, payment, stock movement or journal. See `P528-IMPLEMENTATION.md`, `P528-RUNBOOK.md`, `P528-STATUS.md`, and the updated cumulative gap register.


P528 (`0.528.0-dev`) adds authoritative checks against current organisation/outlet status, operating mode, verified licence activity, active catalogue products, outlet prices, retail stock and payment allocation consistency. Failed checks hold intents; passing checks remain unposted. Bar stock and ledger posting remain disabled pending further controls and runtime/legal acceptance.


## P529 — Offline Posting Approval

P529 adds a separate, organisation-scoped maker-checker approval for offline posting intents. Both P527 structural validation and P528 authoritative checks must pass; the approver must differ from the creator, submitter, reviewer, validator and authoritative checker. Approval evidence is immutable and hashed, and approval/rejection is audited. `AUTHORIZED_TO_POST` is an authorization marker only: no sale, payment, inventory movement or accounting journal is created. See `P529-IMPLEMENTATION.md`, `P529-RUNBOOK.md`, `P529-STATUS.md`, and the updated cumulative gap register.


## P531 update

P531 adds transactional offline bar checkout with measure-aware peg/open-bottle depletion, bottle and packaged stock movements, KOT, offline payment evidence, bottle reservations, wastage and breakage controls. See `P531-IMPLEMENTATION.md`, `P531-RUNBOOK.md` and `P531-TEST-REPORT.md`. The release remains developer preview pending PostgreSQL/API/concurrency/security/browser validation.


## P531 implementation references

See `P531-IMPLEMENTATION.md`, `P531-RUNBOOK.md`, `P531-STATUS.md`, `P531-TEST-REPORT.md`, `P513-ONWARD-GAP-REGISTER.md` and `P513-P531-Cumulative-Gap-Register.docx`. P531 static acceptance is 31/31; PostgreSQL runtime, API integration, concurrency/failure-injection and browser E2E were not run in this environment.
