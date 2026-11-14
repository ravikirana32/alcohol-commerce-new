# P533 Runbook — Excise & Regulatory Compliance

## Deployment

1. Install workspace dependencies: `npm install`.
2. Configure PostgreSQL and `DATABASE_URL`.
3. Apply migration 232 using the repository migration runner.
4. Deploy API and web applications at `0.533.0-dev`.
5. Confirm the seeded `KA-BASE-2025-12` pack is `DRAFT`; do not bypass the independent review process.

## Legal activation workflow

1. A qualified Karnataka excise/legal reviewer checks every rule and source in the draft pack against the currently effective Gazette, Act, rules, licence type and authority orders.
2. Platform administrator A submits the pack for review.
3. Platform administrator B, different from A, approves/rejects with written notes.
4. Platform administrator C, distinct from A and B, activates the approved pack.
5. The activation retires the previous active pack for the jurisdiction. Every lifecycle action is retained in immutable audit history.

## Outlet licence setup

1. Register the actual licence against the outlet; jurisdiction is derived from the outlet state code.
2. Obtain independent platform verification of the licence and permitted activities.
3. Select the verified licence under **Compliance**.
4. Enter each day's opening and closing time exactly as shown on the signed/current licence. Leave closed days blank.
5. A different platform administrator verifies the schedule. Until verified, sales are blocked.

## Dry-day orders

1. Register the official order reference, date, district scope, source URL and reason.
2. A different platform administrator approves/rejects the order.
3. Only ACTIVE orders block the matching district/date. Gandhi Jayanti is evaluated from the seeded statutory rule.

## POS operator workflow

- Before each retail/bar checkout, check acceptable proof of age and confirm the customer is at least 21.
- Confirm the customer is not intoxicated and not in another restricted category.
- For bar sales, confirm meals/eatables are supplied as required by the applicable bar licence.
- Never override an `EXCISE_COMPLIANCE_BLOCKED` response. Review the reason codes and correct the licence/rule configuration through the formal review path.

## Diagnostics

- `GET /api/v1/excise/rule-packs` — current rule pack states.
- `GET /api/v1/excise/dry-day-orders` — registered orders.
- `GET /api/v1/excise/decisions` — immutable decision history.
- `POST /api/v1/excise/evaluate` — non-sale compliance preview; still records an auditable preview decision.

## Emergency handling

- Do not manually activate a pack or alter the compliance decision table.
- If an official order is received after checkout begins, register it immediately and pause affected sales until the order's scope/effective time is verified.
- If a rule pack is incorrect, create a corrected version, review it independently and activate the new version; do not edit an active pack.
- Offline alcohol posting remains blocked until P538 supplies server-verified hardware-backed device-time evidence. All other Indian states remain blocked until their own legal pack is reviewed and activated.
