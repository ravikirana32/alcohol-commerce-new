#!/usr/bin/env bash
set -Eeuo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
LOG_DIR="${P545_EVIDENCE_DIR:-./artifacts/p545-runtime}"
mkdir -p "$LOG_DIR"
if ! command -v docker >/dev/null 2>&1; then echo "BLOCKED: Docker CLI unavailable" | tee "$LOG_DIR/result.txt"; exit 2; fi
if ! docker compose version >/dev/null 2>&1; then echo "BLOCKED: Docker Compose plugin unavailable" | tee "$LOG_DIR/result.txt"; exit 2; fi
if [[ ! -f .env ]]; then echo "BLOCKED: .env missing; copy .env.docker.example and set secrets" | tee "$LOG_DIR/result.txt"; exit 2; fi
node scripts/verify-p544-environment.mjs --env-file=.env | tee "$LOG_DIR/environment-preflight.txt"
docker compose config > "$LOG_DIR/compose-rendered.yml"
docker compose config --quiet
docker compose up -d --build | tee "$LOG_DIR/compose-up.txt"
docker compose ps | tee "$LOG_DIR/compose-ps.txt"
# Poll service health for up to 180 seconds; never remove volumes or reset the database.
for service in postgres redis api web; do
  healthy=0
  for _ in $(seq 1 36); do
    state="$(docker compose ps --format json "$service" 2>/dev/null || true)"
    if printf '%s' "$state" | grep -qi 'healthy'; then healthy=1; break; fi
    sleep 5
  done
  if [[ "$healthy" -ne 1 ]]; then echo "BLOCKED: $service did not report healthy" | tee -a "$LOG_DIR/result.txt"; docker compose logs --no-color --tail=200 "$service" > "$LOG_DIR/${service}-logs.txt" || true; exit 1; fi
done
API_BASE_URL="${API_BASE_URL:-http://127.0.0.1:${API_PORT:-8080}}" WEB_BASE_URL="${WEB_BASE_URL:-http://127.0.0.1:${WEB_PORT:-5173}}" node scripts/smoke-p544.mjs | tee "$LOG_DIR/smoke.txt"
docker compose exec -T postgres pg_isready -U acp -d acp | tee "$LOG_DIR/postgres-ready.txt"
npm run db:status --workspace @acp/api | tee "$LOG_DIR/migration-status.txt"
echo "PASS: runtime validation commands completed; inspect all evidence before sign-off" | tee "$LOG_DIR/result.txt"
