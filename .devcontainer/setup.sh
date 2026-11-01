#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
node --version
npm ci --ignore-scripts --no-audit --no-fund
npm --prefix apps/web ci --ignore-scripts --no-audit --no-fund
printf '\nIFund is installed. Run npm run dev:preview, then open forwarded port 5173.\n'
