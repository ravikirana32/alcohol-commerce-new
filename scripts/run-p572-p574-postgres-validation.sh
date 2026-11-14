#!/usr/bin/env bash
set -euo pipefail
: "${DATABASE_URL:?Set DATABASE_URL to a disposable PostgreSQL database}"
npm run db:migrate
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f scripts/verify-p572-p574-postgres.sql
