# P537 Cumulative Developer Preview

Release `0.537.0-dev`, cumulative from P536. Review `P537-IMPLEMENTATION.md`, `P537-TEST-REPORT.md`, `P537-STATUS.md`, `P537-RUNBOOK.md`, `P537-RELEASE-NOTES.md` and `P513-P535-Cumulative-Gap-Register.md` (coverage updated through P537).

Run static checks:

```bash
node scripts/verify-p537-trade-portal.mjs
node scripts/check-typescript-syntax.mjs
python3 scripts/verify-migrations.py
```

Runtime and production acceptance are not established.
