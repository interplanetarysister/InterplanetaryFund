#!/usr/bin/env python3
"""Read-only local readiness diagnostics for Interplanetary Fund.

No external requests, environment value printing, mutations, or deployments.
A CHECK is not necessarily a failure: branches can have different layouts.
"""
from __future__ import annotations

import json
import os
import shutil
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def check(label: str, condition: bool) -> None:
    print(f"[{'OK' if condition else 'CHECK'}] {label}")


def run_git(*args: str) -> str | None:
    try:
        result = subprocess.run(
            ["git", *args], cwd=ROOT, capture_output=True, text=True,
            timeout=10, check=False,
        )
        return result.stdout.strip() if result.returncode == 0 else None
    except (OSError, subprocess.TimeoutExpired):
        return None


def configured_names() -> set[str]:
    names = {key for key, value in os.environ.items() if value}
    for folder in (ROOT, ROOT / "apps" / "web"):
        for filename in (".env", ".env.local", ".env.development"):
            path = folder / filename
            if not path.is_file():
                continue
            try:
                lines = path.read_text(encoding="utf-8").splitlines()
            except OSError:
                continue
            for line in lines:
                line = line.strip()
                if not line or line.startswith("#") or "=" not in line:
                    continue
                key, value = line.split("=", 1)
                key = key.removeprefix("export ").strip()
                if key and value.strip() and not value.strip().startswith("#"):
                    names.add(key)
    return names


def package_status(relative: str) -> None:
    path = ROOT / relative
    if not path.is_file():
        check(f"{relative} exists", False)
        return
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
        scripts = data.get("scripts", {})
        check(f"{relative} valid JSON", isinstance(scripts, dict))
        if isinstance(scripts, dict):
            print("  available scripts:", ", ".join(sorted(scripts)) or "(none)")
    except (OSError, ValueError):
        check(f"{relative} valid JSON", False)


def main() -> None:
    print("Interplanetary Fund | local migration readiness")
    print("Repository:", ROOT)
    print("Branch:", run_git("branch", "--show-current") or "(unknown)")
    changes = run_git("status", "--porcelain")
    if changes is not None:
        print("Uncommitted entries:", len(changes.splitlines()))

    print("\nDevelopment tools")
    for name in ("git", "node", "npm"):
        check(f"{name} executable", shutil.which(name) is not None)

    print("\nApplication packages")
    for relative in ("package.json", "apps/web/package.json"):
        package_status(relative)

    print("\nProject paths (a missing path may belong to another branch)")
    paths = {
        "Root React application": "src/App.jsx",
        "Independent web app": "apps/web",
        "Supabase migrations": "supabase/migrations",
        "Migration evidence": "docs/migration",
        "Agent rules": "AGENTS.md",
        "Deployment gates": "apps/web/DEPLOYMENT-GATES.md",
    }
    for label, relative in paths.items():
        check(label, (ROOT / relative).exists())

    print("\nCloudflare source/config candidates")
    candidates = (
        "wrangler.toml", "wrangler.jsonc", "host/gateway/worker.js",
        "workers", "cloudflare",
    )
    check("A candidate exists", any((ROOT / p).exists() for p in candidates))

    print("\nLocal browser configuration (names only; no values)")
    names = configured_names()
    check("VITE_SUPABASE_URL", "VITE_SUPABASE_URL" in names)
    check(
        "Supabase public browser key",
        any(name in names for name in (
            "VITE_SUPABASE_PUBLISHABLE_KEY", "VITE_SUPABASE_ANON_KEY",
        )),
    )

    print("\nLimits")
    print("- Does not verify remote Cloudflare bindings or deployments.")
    print("- Does not prove SQL migrations were applied or RLS passes.")
    print("- Does not verify authentication, payments, or feature parity.")
    print("- Makes no changes and does not expose secrets.")


if __name__ == "__main__":
    main()
