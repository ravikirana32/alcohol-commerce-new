# P511 Operations Runbook

## Health
- API liveness: `GET /api/health/live`
- API readiness: `GET /api/health/ready`
- Container status: `docker compose ps`
- Recent logs: `docker compose logs --tail=200 api web migrate postgres redis`

## Backup
From project root:
```bash
./scripts/db-backup.sh
```
On Windows PowerShell, run the shell script from WSL/Git Bash or use:
```powershell
docker compose exec -T postgres pg_dump -U acp -d acp -Fc > "acp-backup.dump"
```
Store backups encrypted and outside the host. Do not commit backup files or secrets.

## Restore
Restore only into a disposable/staging environment first:
```bash
cat acp-backup.dump | docker compose exec -T postgres pg_restore -U acp -d acp --clean --if-exists
```
The restore command is destructive to target objects. Confirm target database and obtain approval before production restore.

## Release operations
- Capture image tags, git commit, migration status and backup ID.
- Run readiness checks after deploy.
- Verify backup restore at least quarterly and before major releases.
- Document incident owner, severity, timeline, customer impact and corrective actions.
- Rollback app image separately from schema; use forward-fix migrations unless a tested rollback exists.

## Not yet delivered
Centralised metrics/log aggregation, alert routing, SLO dashboards, load testing and a tested point-in-time recovery design require deployment-specific configuration.
