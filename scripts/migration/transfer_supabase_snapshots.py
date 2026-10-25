#!/usr/bin/env python3
"""IFund private shadow-data transfer (no Base44 calls, no public activation).

Requires Python 3.11+ and psycopg 3 (install locally: python -m pip install psycopg[binary]).
Use only with the owner's authenticated source and destination PostgreSQL credentials.

Required environment (runtime secrets, NEVER commit them):
  IFUND_SOURCE_DATABASE_URL - old project tzehxfikoslihnclhxuz
  IFUND_TARGET_DATABASE_URL - new project ssibsfmtodgximseeqsv

Default: READ-ONLY compare. With --apply, copy only campaign/content shadows into
ifund_transfer private RLS tables, verifying their SHA-256 hashes before commit.
Never creates users, activates payments, publishes campaigns, or copies credentials.
"""

import argparse
import collections
import hashlib
import os
import sys
from urllib.parse import unquote, urlsplit

SOURCE_PROJECT = "tzehxfikoslihnclhxuz"
TARGET_PROJECT = "ssibsfmtodgximseeqsv"


def expected_project(uri: str, ref: str) -> bool:
    """Require a direct host or Supavisor username tied to the expected project."""
    try:
        u = urlsplit(uri)
        return (
            u.scheme in ("postgres", "postgresql")
            and u.hostname is not None
            and (
                u.hostname.lower() == "db." + ref + ".supabase.co"
                or unquote(u.username or "").lower().endswith("." + ref)
            )
        )
    except ValueError:
        return False


def digest(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def checked_database_urls():
    s = os.getenv("IFUND_SOURCE_DATABASE_URL", "")
    t = os.getenv("IFUND_TARGET_DATABASE_URL", "")
    if not expected_project(s, SOURCE_PROJECT):
        raise RuntimeError("Source database project identity not verified")
    if not expected_project(t, TARGET_PROJECT):
        raise RuntimeError("Destination database project identity not verified")
    if s == t:
        raise RuntimeError("Source and target must differ")
    return s, t


def source_rows(cur, dataset):
    if dataset == "campaigns":
        cur.execute(
            "SELECT source_id, to_jsonb(s)::text AS payload "
            "FROM ifund_migration.campaign_shadow s ORDER BY source_id"
        )
        return [(str(key), data) for key, data in cur.fetchall()]
    if dataset == "content":
        cur.execute(
            "SELECT entity_type, source_id, source_payload::text "
            "FROM ifund_migration.content_shadow ORDER BY entity_type, source_id"
        )
        return [(str(entity), str(key), data) for entity, key, data in cur.fetchall()]
    raise ValueError("Unknown dataset")


def check_one(dst, dataset, row):
    if dataset == "campaigns":
        src_key, payload = row
        dst.execute(
            "SELECT source_payload::text, source_digest_sha256 "
            "FROM ifund_transfer.campaign_snapshots WHERE source_id=%s",
            (src_key,),
        )
    else:
        entity, src_key, payload = row
        dst.execute(
            "SELECT source_payload::text, source_digest_sha256 "
            "FROM ifund_transfer.content_snapshots "
            "WHERE entity_type=%s AND source_id=%s",
            (entity, src_key),
        )
    saved = dst.fetchone()
    if saved is None:
        return False
    return saved[1] == digest(payload) and digest(saved[0]) == digest(payload)


def transfer_one(dst, dataset, row):
    if dataset == "campaigns":
        src_key, payload = row
        dst.execute(
            "INSERT INTO ifund_transfer.campaign_snapshots "
            "(source_id,source_payload,source_digest_sha256) "
            "VALUES (%s,%s::jsonb,%s) "
            "ON CONFLICT (source_id) DO UPDATE SET "
            "source_payload=EXCLUDED.source_payload, "
            "source_digest_sha256=EXCLUDED.source_digest_sha256, "
            "imported_at=now()",
            (src_key, payload, digest(payload)),
        )
    else:
        entity, src_key, payload = row
        dst.execute(
            "INSERT INTO ifund_transfer.content_snapshots "
            "(entity_type,source_id,source_payload,source_digest_sha256) "
            "VALUES (%s,%s,%s::jsonb,%s) "
            "ON CONFLICT (entity_type,source_id) DO UPDATE SET "
            "source_payload=EXCLUDED.source_payload, "
            "source_digest_sha256=EXCLUDED.source_digest_sha256, "
            "imported_at=now()",
            (entity, src_key, payload, digest(payload)),
        )


def update_inventory(dst, campaigns, content):
    dst.execute(
        "UPDATE ifund_transfer.source_inventory SET staged_target_rows=%s,"
        "observed_at=now() WHERE source_relation="
        "'ifund_migration.campaign_shadow' AND entity_type='Campaign'",
        (len(campaigns),),
    )
    by_type = collections.Counter(row[0] for row in content)
    for entity, count in by_type.items():
        dst.execute(
            "UPDATE ifund_transfer.source_inventory SET staged_target_rows=%s,"
            "observed_at=now() WHERE source_relation="
            "'ifund_migration.content_shadow' AND entity_type=%s",
            (count, entity),
        )


def run(apply: bool):
    import psycopg

    source_url, target_url = checked_database_urls()
    # Do not include connection URI or row bodies in errors/logs.
    with psycopg.connect(source_url, connect_timeout=15) as source, psycopg.connect(
        target_url, connect_timeout=15
    ) as target:
        with source.cursor() as sc, target.cursor() as tc:
            sc.execute("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ, READ ONLY")
            campaigns = source_rows(sc, "campaigns")
            content = source_rows(sc, "content")
            if len({r[0] for r in campaigns}) != len(campaigns):
                raise RuntimeError("Duplicate campaign source IDs")
            if len({(r[0], r[1]) for r in content}) != len(content):
                raise RuntimeError("Duplicate content source IDs")

            for dataset, values in (("campaigns", campaigns), ("content", content)):
                already = 0
                for row in values:
                    if check_one(tc, dataset, row):
                        already += 1
                    elif apply:
                        transfer_one(tc, dataset, row)
                        if not check_one(tc, dataset, row):
                            raise RuntimeError("Source/target canonical JSON digest mismatch")
                print(f"{dataset}: source={len(values)} matching_before={already}")

            if apply:
                for dataset, values in (("campaigns", campaigns), ("content", content)):
                    if not all(check_one(tc, dataset, row) for row in values):
                        raise RuntimeError("Final source/destination digest comparison failed")
                update_inventory(tc, campaigns, content)
                target.commit()
                print("Verified private snapshots committed; no public rows activated.")
            else:
                target.rollback()
                print("Dry run only. No records changed. Use --apply for private transfer.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--apply", action="store_true", help="Transfer after digest verification")
    args = parser.parse_args()
    try:
        run(args.apply)
    except Exception:
        # A credential-bearing connection exception must NEVER appear in a public CI log.
        print("Import stopped safely. Verify private connection, schema, and row digests.", file=sys.stderr)
        sys.exit(1)
