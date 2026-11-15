# Phase 1 Deferred Acceptance Checks

**Decision date:** 15 November 2026  
**Status:** Implementation complete; final operational acceptance is deferred.

Phase 1 bar-service and tab-lifecycle code is implemented. Its automated checks currently include API/database coverage and browser tests with mocked API responses. The combined browser-to-live-PostgreSQL journey has not yet been run.

At the user's direction, these acceptance checks will not block work on Phases 2–8. They will be revisited together after the eight planned implementation phases are complete, before a production-readiness decision or live deployment.

## Deferred checks

- Run a combined browser, API, and PostgreSQL journey for the critical bar-tab flow, including retries, station-routed KOTs, inventory effects, and audit evidence.
- Validate the print/KOT workflow against the selected physical printer or KDS, including outage and recovery behavior.
- Complete operator UAT and obtain accounting/legal sign-off for wastage disposition, refunds, tax/excise configuration, and shift closeout.

## Guardrails while deferred

- The application remains **not production-ready**; deferring checks is not approval to deploy or process live customer payments.
- Preserve the current manager-approval, inventory, idempotency, and audit controls while later phases are implemented.
- Keep any discovered blocker documented and resolve it before production readiness, even if it is found after Phase 8.
