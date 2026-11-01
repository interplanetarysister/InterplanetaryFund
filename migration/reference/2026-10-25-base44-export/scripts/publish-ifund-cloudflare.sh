#!/usr/bin/env bash
# Safe direct Cloudflare publishing lane. Does not modify production DNS.
set -eo pipefail
cd "$(dirname "$0")/.."
mode="validate"
if [[ "$#" -gt 0 ]]; then mode="$1"; fi
if [[ "$mode" != "validate" && "$mode" != "deploy-preview" ]]; then
  echo "Usage: bash scripts/publish-ifund-cloudflare.sh validate|deploy-preview" >&2
  exit 2
fi
if [[ -z "$VITE_BASE44_APP_ID" || -z "$VITE_BASE44_APP_BASE_URL" ]]; then
  cat >&2 <<'TEXT'
Direct-host builds require the existing Base44 backend settings until
IFund migrates database/auth/functions/agents:
  export VITE_BASE44_APP_ID='your existing Base44 app ID'
  export VITE_BASE44_APP_BASE_URL='your verified Base44 backend origin'
Do not put private API tokens or passwords in VITE_ frontend values.
TEXT
  exit 2
fi
echo "Checking IFund source and agent tool declarations..."
npm run verify:agent-dependencies
npm run build
node scripts/verify-help-center-scaffold.mjs
node scripts/verify-ifund-browser-render.mjs
node scripts/verify-help-center-browser.mjs
if [[ "$mode" == "validate" ]]; then
  echo "PASS validation only. No Cloudflare deployment and no DNS changes."
  exit 0
fi
if [[ "$IFUND_CONFIRM_PREVIEW_DEPLOY" != "yes" ]]; then
  echo "Set IFUND_CONFIRM_PREVIEW_DEPLOY=yes for explicit Cloudflare preview deployment." >&2
  exit 2
fi
if [[ ! -x node_modules/.bin/wrangler ]]; then
  echo "Wrangler is not installed. Run npm install --save-dev wrangler on the publishing machine." >&2
  exit 2
fi
# Root wrangler.toml targets the Workers preview; the production domain
# is not cut over by this script.
./node_modules/.bin/wrangler deploy --config wrangler.toml
echo "Preview deploy command completed. Verify the returned URL and backend calls before changing production routing."
