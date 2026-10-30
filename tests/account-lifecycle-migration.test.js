import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const sql = readFileSync(new URL('../supabase/migrations/pending/20261030_ifund_account_lifecycle.sql', import.meta.url), 'utf8');

test('existing unmapped profiles are reset to NULL without changing later signups', () => {
  assert.match(sql, /ADD COLUMN IF NOT EXISTS account_status text\s*,\s*ADD COLUMN IF NOT EXISTS account_deletion_pending boolean/i);
  assert.match(sql, /ALTER COLUMN account_status DROP DEFAULT/i);
  assert.match(sql, /ALTER COLUMN account_status DROP NOT NULL/i);
  assert.match(sql, /ALTER COLUMN account_deletion_pending DROP DEFAULT/i);
  assert.match(sql, /ALTER COLUMN account_deletion_pending DROP NOT NULL/i);
  assert.match(sql, /UPDATE public\.ifund_profiles[\s\S]*?SET account_status = NULL, account_deletion_pending = NULL[\s\S]*?WHERE created_at < '2026-10-30 18:05:29\+00'/i);
  assert.match(sql, /account_status IS NULL OR account_status IN \('active', 'disabled'\)/i);
});

test('new signups alone receive active lifecycle defaults from the trusted Auth trigger', () => {
  assert.match(sql, /INSERT INTO public\.ifund_profiles\s*\(id, display_name, account_status, account_deletion_pending\)\s*VALUES\s*\(new\.id,[\s\S]*?'active', false\)/i);
  assert.match(sql, /GRANT EXECUTE ON FUNCTION public\.ifund_create_auth_profile\(\)\s*TO supabase_auth_admin/i);
  assert.match(sql, /REVOKE EXECUTE ON FUNCTION public\.ifund_create_auth_profile\(\)[\s\S]*?FROM PUBLIC, anon, authenticated, service_role/i);
});

test('lifecycle fields are not browser writable and are service-controlled', () => {
  assert.match(sql, /REVOKE INSERT \(account_status, account_deletion_pending\),\s*UPDATE \(account_status, account_deletion_pending\)[\s\S]*?FROM PUBLIC, anon, authenticated/i);
  assert.match(sql, /GRANT SELECT \(account_status, account_deletion_pending\),\s*UPDATE \(account_status, account_deletion_pending\)[\s\S]*?TO service_role/i);
});

test('RLS helper is invoker-safe, keeps anonymous public reads, and requires an active signed-in profile', () => {
  const helperStart=sql.indexOf('CREATE OR REPLACE FUNCTION public.ifund_current_account_is_active()');
  const helperEnd=sql.indexOf('REVOKE ALL ON FUNCTION public.ifund_current_account_is_active()',helperStart);
  const helper=sql.slice(helperStart,helperEnd);
  assert.match(helper, /SECURITY INVOKER\s+SET search_path TO ''[\s\S]*?WHEN caller\.uid IS NULL THEN true/i);
  assert.doesNotMatch(helper, /SECURITY DEFINER/i);
  assert.match(helper, /p\.account_status = 'active'/i);
  assert.match(helper, /p\.account_deletion_pending IS FALSE/i);
  assert.match(sql, /GRANT EXECUTE ON FUNCTION public\.ifund_current_account_is_active\(\)\s*TO anon, authenticated/i);
  assert.doesNotMatch(sql, /DROP POLICY IF EXISTS ifund_profiles_read/i);
});

test('every authenticated owner or public-data policy is lifecycle-gated', () => {
  const names = [
    'ifund_profiles_insert', 'ifund_profiles_update',
    'ifund_campaigns_delete', 'ifund_campaigns_insert', 'ifund_campaigns_public_read', 'ifund_campaigns_update',
    'ifund_posts_delete', 'ifund_posts_insert', 'ifund_posts_public_read',
    'ifund_connections_owner_read',
    'ifund_legal_acceptance_owner_insert', 'ifund_legal_acceptance_owner_select',
    'ifund_notifications_owner_acknowledge', 'ifund_notifications_owner_select',
    'ifund_blogs_owner_delete', 'ifund_blogs_owner_update', 'ifund_blogs_read_active_or_owner',
    'ifund_blog_entries_owner_delete', 'ifund_blog_entries_owner_insert',
    'ifund_blog_entries_owner_update', 'ifund_blog_entries_read_public_or_owner',
  ];
  for (const name of names) {
    const match = sql.match(new RegExp('CREATE POLICY ' + name + '\\b[\\s\\S]*?;', 'i'));
    assert.ok(match, 'missing policy ' + name);
    assert.match(match[0], /\(SELECT public\.ifund_current_account_is_active\(\)\)/i, name + ' is not lifecycle-gated');
  }
});
