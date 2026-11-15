#!/usr/bin/env bash
# Read-only preflight of the actual NEW IFund AAB, never the preserved Base44 APK.
# Java/Kotlin-only apps need no ELF segment adjustment; native .so plugins
# require extra alignment verification and 16 KB device acceptance.
set -euo pipefail
bundle="${1:-}"
test -n "$bundle" && test -s "$bundle" || {
  echo "Missing independent Android App Bundle." >&2
  exit 1
}
if unzip -Z1 "$bundle" | grep -Eq '(^|/)lib/[^/]+/[^/]+\.so$'; then
  echo "Native ELF libraries found: do not claim 16 KB compliance without bundletool, ELF alignment and device validation." >&2
  exit 1
fi
echo "No native .so libraries found in this AAB. The app still requires Android 16 KB device tests and Play Console verification."
