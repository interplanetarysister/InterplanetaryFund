#!/usr/bin/env python3
"""Archive Base44-hosted artwork into the existing web application's public assets.

Runs in GitHub Actions, where public artwork URLs can be downloaded. Never copies
private/authenticated media or embeds credentials. Writes SHA-256 inventory.
"""
import hashlib
import json
import pathlib
import re
import urllib.parse
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parents[1]
WEB = ROOT / "apps/web"
OUT = WEB / "public" / "images" / "base44-archive"
EXTENSIONS = {".png", ".jpg", ".jpeg", ".webp", ".gif", ".svg"}
PATTERN = re.compile(r"https://media\.base44\.com/[A-Za-z0-9_./%?=&-]+")
MAX_BYTES = 15 * 1024 * 1024

def discover():
    urls = set()
    for base in (ROOT / "src", WEB / "src"):
        if not base.exists():
            continue
        for path in base.rglob("*"):
            if path.suffix.lower() not in {".js", ".jsx", ".ts", ".tsx", ".css", ".json"}:
                continue
            for match in PATTERN.findall(path.read_text(encoding="utf-8", errors="replace")):
                urls.add(match.rstrip("'),;\""))
    return sorted(urls)

def main():
    OUT.mkdir(parents=True, exist_ok=True)
    records = []
    failures = []
    for url in discover():
        parsed = urllib.parse.urlparse(url)
        if parsed.scheme != "https" or parsed.hostname != "media.base44.com":
            continue
        extension = pathlib.PurePosixPath(parsed.path).suffix.lower()
        if extension not in EXTENSIONS:
            continue
        name = hashlib.sha256(url.encode()).hexdigest()[:20] + extension
        target = OUT / name
        try:
            if not target.exists():
                request = urllib.request.Request(url, headers={"User-Agent": "IFund-artwork-archiver/1.0"})
                with urllib.request.urlopen(request, timeout=30) as response:
                    if int(response.headers.get("Content-Length") or 0) > MAX_BYTES:
                        raise ValueError("Image exceeds size limit")
                    data = response.read(MAX_BYTES + 1)
                    if len(data) > MAX_BYTES:
                        raise ValueError("Image exceeds size limit")
                    if not data:
                        raise ValueError("Empty image")
                    target.write_bytes(data)
            records.append({"source": url, "local": "/images/base44-archive/" + name,
                            "sha256": hashlib.sha256(target.read_bytes()).hexdigest(),
                            "bytes": target.stat().st_size})
        except Exception as error:
            failures.append({"source": url, "error": str(error)[:200]})
    (OUT / "manifest.json").write_text(json.dumps({"assets": records, "failed": failures}, indent=2) + "\n")
    print(f"Archived {len(records)} assets; failed {len(failures)}")
    if failures:
        raise SystemExit("Some public Base44 assets could not be archived; inspect manifest.")

if __name__ == "__main__":
    main()
