# P511 Operational Acceptance
- Run backup on disposable DB and validate archive.
- Restore to a clean staging DB and compare row counts and application health.
- Simulate API process restart, DB restart and Redis restart.
- Measure recovery time and record RTO/RPO approved by business.
- Verify secrets are excluded from logs and archives.
- Load test realistic outlet concurrency.
- Configure external alerting and central logs before pilot.
