# P524 Runbook — Offline & Devices

## Start
1. Copy `.env.example` to `.env` and configure the API/database values.
2. Run `npm install` from the repository root.
3. Run migrations with `npm run db:migrate` after PostgreSQL is configured.
4. Start services using `npm run dev` (or `docker compose up -d --build`).
5. Sign in and open **Offline & Devices**.

## Browser checks
- Toggle network connectivity in browser developer tools and confirm the status changes.
- Add a diagnostic event; refresh the page and confirm the local queue retains it.
- Focus the barcode input and scan a keyboard-wedge barcode ending in Enter.
- Use the print dialog and select a configured printer.

## Important
These are local browser checks, not proof of end-to-end offline sales synchronisation or hardware integration. Diagnostic events are not sales. Do not use offline mode to accept payments or dispense/sell regulated products. The browser print dialog does not prove direct printer protocol support.
