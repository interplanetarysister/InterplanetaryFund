"""Offline tests for private IFund import. No network or database required."""
import importlib.util
import json
import pathlib
import unittest


def load_importer():
    path = (
        pathlib.Path(__file__).resolve().parents[1]
        / "scripts"
        / "migration"
        / "transfer_supabase_snapshots.py"
    )
    spec = importlib.util.spec_from_file_location("private_transfer", path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


m = load_importer()


class FakeCursor:
    def __init__(self, row=None):
        self.row = row
        self.statements = []

    def execute(self, sql, args=None):
        self.statements.append((sql, args))

    def fetchone(self):
        return self.row


class TransferGuards(unittest.TestCase):
    def test_source_and_target_host_pins(self):
        self.assertTrue(m.expected_project(
            "postgresql://postgres:fake@db.tzehxfikoslihnclhxuz.supabase.co/postgres",
            m.SOURCE_PROJECT,
        ))
        self.assertTrue(m.expected_project(
            "postgresql://postgres.ssibsfmtodgximseeqsv:fake@aws-0-us-west-2.pooler.supabase.com/postgres",
            m.TARGET_PROJECT,
        ))
        self.assertFalse(m.expected_project(
            "postgresql://postgres.tzehxfikoslihnclhxuz:fake@attacker.example/postgres",
            m.SOURCE_PROJECT,
        ))
        self.assertFalse(m.expected_project(
            "postgresql://postgres:fake@db.ssibsfmtodgximseeqsv.supabase.co/postgres",
            m.SOURCE_PROJECT,
        ))
        self.assertFalse(m.expected_project(
            "postgresql://postgres:fake@db.tzehxfikoslihnclhxuz.supabase.co/postgres?sslmode=disable",
            m.SOURCE_PROJECT,
        ))
        self.assertFalse(m.expected_project("", m.SOURCE_PROJECT))

    def test_hash_of_canonical_text(self):
        payload = '{"amount": 1.00, "title": "Demo"}'
        self.assertEqual(len(m.digest(payload)), 64)
        self.assertNotEqual(m.digest(payload), m.digest('{"amount": 1, "title": "Demo"}'))

    def test_source_record_allows_verified_shapes(self):
        for entity in ("CampaignUpdate", "PlatformConnection"):
            m.assert_source_record_safe((
                entity, "id-1", json.dumps({"source_campaign_id": "c-1", "connection": {
                    "fresh_provider_authorization_required": True
                }}), None, None, None
            ))

    def test_source_record_rejects_nested_secrets(self):
        for payload in (
            {"api_key": "DO_NOT_COPY"},
            {"nested": {"refresh_token": "DO_NOT_COPY"}},
            {"list": [{"secret_reference": "DO_NOT_COPY"}]},
        ):
            with self.assertRaises(RuntimeError):
                m.assert_source_record_safe((
                    "PlatformConnection", "id-1", json.dumps(payload), None, None, None
                ))

    def test_source_record_rejects_unknown_types(self):
        with self.assertRaises(RuntimeError):
            m.assert_source_record_safe(("Donation", "id", "{}", None, None, None))

    def test_mismatched_payload_never_counts_as_verified(self):
        canonical = '{"status": "draft"}'
        cur = FakeCursor(row=('{"status": "active"}', m.digest(canonical)))
        self.assertFalse(m.check_one(cur, "campaigns", ("source-id", canonical)))

    def test_matches_same_payload_and_digest(self):
        canonical = '{"status": "draft"}'
        cur = FakeCursor(row=(canonical, m.digest(canonical)))
        self.assertTrue(m.check_one(cur, "campaigns", ("source-id", canonical)))

    def test_source_records_selects_private_destination(self):
        payload = '{"id": "test"}'
        cur = FakeCursor(row=(payload, m.digest(payload)))
        self.assertTrue(m.check_one(cur, "source_records", (
            "CampaignUpdate", "source-id", payload, None, None, None
        )))
        self.assertIn("ifund_transfer.source_snapshots", cur.statements[-1][0])
        self.assertEqual(cur.statements[-1][1], ("CampaignUpdate", "source-id"))

    def test_source_record_writes_are_idempotent(self):
        payload = '{"id": "test", "title": "Test"}'
        cur = FakeCursor()
        m.transfer_one(cur, "source_records", (
            "CampaignUpdate", "source-id", payload, None, None, None
        ))
        query, args = cur.statements[-1]
        self.assertIn("ON CONFLICT (entity_type,source_id) DO UPDATE", query)
        self.assertIn("ifund_transfer.source_snapshots", query)
        self.assertEqual(args[0:4], ("CampaignUpdate", "source-id", payload, m.digest(payload)))

    def test_no_public_target_for_any_dataset(self):
        for dataset, row in (
            ("campaigns", ("campaign-id", '{"title": "Hello"}')),
            ("content", ("Recommendation", "r1", '{"description": "Test"}')),
            ("source_records", ("CampaignUpdate", "u1", '{"title": "Hello"}', None, None, None)),
        ):
            cur = FakeCursor()
            m.transfer_one(cur, dataset, row)
            query = cur.statements[-1][0]
            self.assertIn("ifund_transfer.", query)
            self.assertNotIn("public.", query)
            self.assertNotIn("ifund_finance.", query)


if __name__ == "__main__":
    unittest.main()
