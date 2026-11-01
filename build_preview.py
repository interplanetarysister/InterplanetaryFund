#!/usr/bin/env python3
"""Build IFund's coded frontend and API; optionally publish its preview."""
import argparse
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import urllib.request

ROOT = Path(__file__).resolve().parent
SUPABASE_URL = "https://ssibsfmtodgximseeqsv.supabase.co"
CONFIG_URL = "https://fix-source-backed-preview.interplanetaryfund-source-preview.pages.dev/api/public-config"
PREVIEW_PROJECT = "interplanetaryfund-source-preview"


def run(args, env):
    subprocess.run(args, cwd=ROOT, env=env, check=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--deploy", action="store_true", help="Publish only the separate Cloudflare preview project")
    args = parser.parse_args()
    for executable in ("node", "npm", "npx", "git"):
        if not shutil.which(executable):
            raise RuntimeError(f"Install {executable} first, or rebuild the configured Codespace container.")
    required = ("apps/web/package-lock.json", "apps/web/server/worker.js",
                "apps/web/scripts/verify-artifact.mjs", "worker/geocodeCity.js")
    missing = [name for name in required if not (ROOT / name).is_file()]
    if missing:
        raise RuntimeError("Check out fix/source-backed-preview first. Missing: " + ", ".join(missing))
    env = os.environ.copy()
    key = env.get("VITE_SUPABASE_PUBLISHABLE_KEY") or env.get("SUPABASE_PUBLISHABLE_KEY")
    if not key:
        try:
            with urllib.request.urlopen(CONFIG_URL, timeout=15) as response:
                config = json.load(response)
            if config.get("url") == SUPABASE_URL:
                key = config.get("key")
        except Exception:
            pass
    if not isinstance(key, str) or not key.startswith("sb_publishable_"):
        raise RuntimeError("Set VITE_SUPABASE_PUBLISHABLE_KEY as a Codespaces secret. Use the public sb_publishable_ key only.")
    env["VITE_SUPABASE_URL"] = SUPABASE_URL
    env["VITE_SUPABASE_PUBLISHABLE_KEY"] = key
    # No credential value is printed or written to a source file.
    run(["npm", "run", "build:preview"], env)
    manifest_path = ROOT / "apps/web/dist/ifund-build.json"
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    if manifest.get("frontend_root") != "apps/web":
        raise RuntimeError("Wrong frontend artifact.")
    if not (ROOT / "apps/web/dist/_worker.js").is_file():
        raise RuntimeError("The independent API Worker was not built.")
    print("Verified frontend and backend:", ROOT / "apps/web/dist")
    if args.deploy:
        env["CLOUDFLARE_ACCOUNT_ID"] = "c95db4f2c901f32776471b85f1eda15d"
        run(["npx", "--yes", "wrangler@4.156.0", "pages", "deploy", "apps/web/dist",
             "--project-name", PREVIEW_PROJECT, "--branch", "fix/source-backed-preview"], env)
    else:
        print("To publish this artifact to the preview project: python3 build_preview.py --deploy")
    print("This build does not certify unfinished features or change interplanetaryfund.com routing.")


if __name__ == "__main__":
    try:
        main()
    except (RuntimeError, subprocess.CalledProcessError) as error:
        print("Build stopped:", error, file=sys.stderr)
        sys.exit(1)
