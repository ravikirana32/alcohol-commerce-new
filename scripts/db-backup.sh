#!/usr/bin/env bash
set -euo pipefail
: "${DATABASE_URL:?Set DATABASE_URL to the target PostgreSQL database}"
OUT_DIR="${BACKUP_DIR:-./backups}"
mkdir -p "$OUT_DIR"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
OUT="$OUT_DIR/acp-$STAMP.dump"
umask 077
pg_dump --format=custom --no-owner --no-privileges --file="$OUT" "$DATABASE_URL"
pg_restore --list "$OUT" >/dev/null
sha256sum "$OUT" > "$OUT.sha256"
echo "Backup created and archive listing verified: $OUT"
