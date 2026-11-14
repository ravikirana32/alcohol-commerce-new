# P507 — Browser E2E foundation
Version: 0.507.0-dev

Added Playwright configuration, Chromium project, HTML/list reporting, retained traces on failure and initial web/API smoke specs. Install workspace dependencies and browser binaries with `npm install` and `npx playwright install chromium`, then run `npm run test:e2e`.

The initial tests only prove app shell availability and API liveness. Full authenticated workflows for retail/bar checkout, refunds, inventory, shifts, offline sync and role permissions remain to be authored and executed against seeded test data.
