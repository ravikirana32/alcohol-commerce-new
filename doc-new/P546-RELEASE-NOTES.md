# P546 Release Notes

Version `0.546.0-dev` continues the P545 cumulative baseline.

- Added a role-permission-driven demo user seeder for local QA.
- Added safe opt-in and production refusal guards.
- Added local login instructions and role email mapping in `P546-RUNBOOK.md`.
- Added P546 static verifier and database integrity review SQL.
- No production credentials are hard-coded; the shared demo password must be supplied locally.
- PostgreSQL runtime seeding and role-login tests remain pending.
