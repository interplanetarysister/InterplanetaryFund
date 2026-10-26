#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
APP_ID="6a67a778342a8fe05ee79cba"
printf '%s\n' "Building the IFund release..."
./node_modules/.bin/vite build
node scripts/verify-production-build-output.mjs
node scripts/verify-ifund-bundle-graph.mjs
node scripts/verify-ifund-links-assets.mjs
node scripts/test-base44-release.mjs
node scripts/verify-text-contrast-contract.mjs
node --experimental-strip-types scripts/verify-feature-flag-connections.mjs
node scripts/verify-agent-chat-resilience.mjs
node scripts/verify-agent-reasoning-coherence.mjs
node scripts/verify-builder-agent-boundary.mjs
node scripts/test-ifund-image-style.mjs
node scripts/test-generate-campaign-cover.mjs
node scripts/test-campaign-drafts-and-generated-media.mjs
node scripts/test-ifund-login-recovery.mjs
node scripts/test-ifund-device-authorization.mjs
node scripts/verify-ifund-browser-render.mjs
node scripts/verify-mobile-ai-composer-viewport.mjs
node scripts/verify-ifund-navigation.mjs
node scripts/verify-ifund-studio-pages.mjs
node scripts/verify-ifund-design-and-connections.mjs
./node_modules/.bin/tsc -p jsconfig.json --noEmit
./node_modules/.bin/eslint . --quiet
if [ "${IFUND_VALIDATE_ONLY:-0}" = "1" ]; then
  printf '%s\n' "The local release gate passed. Publication skipped in validation-only mode."
  exit 0
fi
printf '%s\n' "The local release gate passed. Checking Base44 CLI authorization before publication."
AUTH_LOG="$(mktemp)"
if ! timeout 15s base44 --app-id "$APP_ID" whoami </dev/null >"$AUTH_LOG" 2>&1; then
  printf '%s\n' "Deployment stopped: Base44 CLI session is not authenticated or authorization check timed out."
  printf '%s\n' "Complete the Base44 device login in an authorized terminal/session, then retry."
  rm -f "$AUTH_LOG"
  exit 1
fi
rm -f "$AUTH_LOG"
printf '%s\n' "Publishing only the Base44 website files."
timeout 150s base44 --app-id "$APP_ID" site deploy --no-build --yes </dev/null
printf '%s\n' "Checking deployed JavaScript against the exact compiled release..."
node scripts/verify-live-release-parity.mjs
printf '%s\n' "Checking production in Chromium..."
IFUND_SMOKE_URL=https://interplanetaryfund.com node scripts/verify-ifund-browser-render.mjs
IFUND_SMOKE_URL=https://interplanetaryfund.com node scripts/verify-mobile-ai-composer-viewport.mjs
IFUND_SMOKE_URL=https://interplanetaryfund.com node scripts/verify-ifund-navigation.mjs
IFUND_SMOKE_URL=https://interplanetaryfund.com node scripts/verify-ifund-studio-pages.mjs
node --input-type=module -e 'import { IFUND_RELEASE_ID } from "./src/lib/ifundRelease.js"; const response = await fetch("https://interplanetaryfund.com/ifund-release.json?release-check="+Date.now(), {cache:"no-store"}); const data=await response.json(); if (data.release_id !== IFUND_RELEASE_ID) throw Error("IFund live release manifest does not match the published source"); console.log("PASS: live Base44 release marker matches source");'
printf '%s\n' "IFund published and production navigation verified."
