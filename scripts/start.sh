#!/usr/bin/env bash
set -Eeuo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

command -v docker >/dev/null 2>&1 || { echo "Docker is required. Install Docker Desktop (Windows/macOS) or Docker Engine + Compose v2 (Linux)." >&2; exit 1; }
docker compose version >/dev/null 2>&1 || { echo "Docker Compose v2 is required." >&2; exit 1; }

if [[ ! -f .env ]]; then
  if ! command -v openssl >/dev/null 2>&1; then echo "openssl is required to generate local secrets." >&2; exit 1; fi
  cp .env.docker.example .env
  DB_SECRET="$(openssl rand -hex 24)"
  JWT_SECRET_VALUE="$(openssl rand -hex 32)"
  BOOTSTRAP_SECRET_VALUE="$(openssl rand -hex 32)"
  if [[ "$(uname -s)" == "Darwin" ]]; then
    sed -i '' "s/replace_me_with_hex_secret/${DB_SECRET}/; s/replace_me_with_at_least_32_random_bytes/${JWT_SECRET_VALUE}/; s/replace_me_with_one_time_random_secret/${BOOTSTRAP_SECRET_VALUE}/" .env
  else
    sed -i "s/replace_me_with_hex_secret/${DB_SECRET}/; s/replace_me_with_at_least_32_random_bytes/${JWT_SECRET_VALUE}/; s/replace_me_with_one_time_random_secret/${BOOTSTRAP_SECRET_VALUE}/" .env
  fi
  chmod 600 .env 2>/dev/null || true
  echo "Created .env with local-only random secrets. Keep it private."
fi
for key in POSTGRES_PASSWORD JWT_SECRET BOOTSTRAP_SECRET; do
  value="$(sed -n "s/^${key}=//p" .env | tail -1)"
  if [[ -z "$value" || "$value" == *replace_me_* || "$value" == *replace-with* ]]; then
    echo "Invalid or placeholder $key in .env. Set a strong unique value or remove .env and rerun to generate local secrets." >&2
    exit 1
  fi
done

printf '\nStarting PostgreSQL, Redis, migrations, API and web UI...\n'
docker compose up -d --build

API_PORT_VALUE="$(sed -n 's/^API_PORT=//p' .env | tail -1)"; API_PORT_VALUE="${API_PORT_VALUE:-8081}"
WEB_PORT_VALUE="$(sed -n 's/^WEB_PORT=//p' .env | tail -1)"; WEB_PORT_VALUE="${WEB_PORT_VALUE:-5174}"

for attempt in $(seq 1 60); do
  if curl -fsS "http://127.0.0.1:${API_PORT_VALUE}/api/health/ready" >/dev/null 2>&1 && curl -fsS "http://127.0.0.1:${WEB_PORT_VALUE}/" >/dev/null 2>&1; then
    echo "\nAlcohol Commerce Platform is running."
    echo "Web: http://localhost:${WEB_PORT_VALUE}"
    echo "API: http://localhost:${API_PORT_VALUE}"
    echo "API readiness: http://localhost:${API_PORT_VALUE}/api/health/ready"
    echo "\nNext: review docs/DOCKER-QUICKSTART.md for first-time bootstrap and manual setup."
    exit 0
  fi
  sleep 3
done

echo "Startup did not become healthy within 3 minutes. Recent logs:" >&2
docker compose ps >&2
docker compose logs --tail=120 >&2
exit 1
