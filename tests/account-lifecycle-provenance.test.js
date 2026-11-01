import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const sql = readFileSync(new URL('../supabase/migrations/20261101150000_ifund_profile_lifecycle_provenance.sql', import.meta.url), 'utf8');

test('lifecycle trust is explicit and never inferred from a timestamp', () => {
  assert.match(sql, /lifecycle_provenance/);
  assert.match(sql, /verified_source_owner_mapping/);
  assert.match(sql, /supabase_auth_signup/);
  assert.doesNotMatch(sql, /created_at\s*[<>]=?/i);
  assert.doesNotMatch(sql, /2026-10-30 18:05:29/i);
});

test('legacy identities require exact verified source-owner and confirmed-email evidence', () => {
  assert.match(sql, /verification_state='verified'/);
  assert.match(sql, /candidate_match_method='confirmed_exact_email'/);
  assert.match(sql, /lower\(mapping\.source_email\)=lower\(destination_user\.email\)/);
  assert.match(sql, /destination_user\.email_confirmed_at IS NOT NULL/);
  assert.match(sql, /source_user\.account_status='active'/);
  assert.match(sql, /source_user\.account_deletion_pending IS FALSE/);
});

test('new signups receive trusted provenance only from the Auth trigger', () => {
  assert.match(sql, /SECURITY DEFINER/);
  assert.match(sql, /'supabase_auth_signup'/);
  assert.match(sql, /TO supabase_auth_admin/);
  assert.match(sql, /FROM PUBLIC, anon, authenticated, service_role/);
  assert.match(sql, /Active profile lacks trusted lifecycle provenance/);
  assert.match(sql, /Browser roles can modify lifecycle provenance/);
});
