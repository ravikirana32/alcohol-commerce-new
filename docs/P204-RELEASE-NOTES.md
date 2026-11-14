# P204 Release Notes — Functional Retail and Bar POS screens

## Scope
Add operational UI workspaces connected to the outlet, price, stock and checkout APIs.

## Changes
- Added Retail POS workspace with outlet, active price, quantity and payment selection
- Added Bar POS workspace with peg/bottle/packaged service and open-bottle selection
- Connected UI to server-side checkout APIs and surfaced API errors
- Added responsive workspace styling and development/staging disclaimer

## Risks / limitations
- POS screens require configured prices, active outlets, verified licence capabilities and user permissions

## Validation
Archive integrity and source syntax checks are reported separately. No database execution or production certification is implied.
