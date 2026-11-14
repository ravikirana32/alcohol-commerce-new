#!/usr/bin/env bash
set -euo pipefail
npm install
npm run typecheck
npm run test
npm run build
