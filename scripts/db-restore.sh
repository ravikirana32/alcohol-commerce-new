#!/usr/bin/env bash
set -euo pipefail
: "${DATABASE_URL:?Set DATABASE_URL to the RESTORE TARGET}"
DUMP="${1:?Usage: scripts/db-restore.sh path/to/backup.dump}"
if [[ ! -f "$DUMP" ]]; then echo "Backup not found: $DUMP" >&2; exit 2; fi
echo "WARNING: restore targets the database in DATABASE_URL and may overwrite objects."
if [[ "${CONFIRM_RESTORE:-}" != "YES" ]]; then echo "Set CONFIRM_RESTORE=YES after verifying target and backup." >&2; exit 3; fi
pg_restore --clean --if-exists --no-owner --no-privileges --dbname="$DATABASE_URL" "$DUMP"
echo "Restore command completed; application-level reconciliation and smoke tests remain mandatory."
