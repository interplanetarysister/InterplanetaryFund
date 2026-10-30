import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const sql = readFileSync(new URL('../supabase/migrations/pending/20261030_ifund_my_giving_owner_scoped_rpc.sql', import.meta.url), 'utf8');

test('My Giving SQL RPC is security-definer with an empty search path and auth-derived ownership', () => {
  assert.match(sql, /SECURITY\s+DEFINER/i);
  assert.match(sql, /SET\s+search_path\s+TO\s+''/i);
  assert.match(sql, /caller_id\s+uuid\s*:=\s*auth\.uid\(\)/i);
  assert.match(sql, /d\.owner_auth_uid\s*=\s*caller_id/i);
  assert.match(sql, /source_user\.owner_auth_uid\s*=\s*caller_id/i);
  assert.match(sql, /d\.payment_verified\s+IS\s+TRUE/i);
  assert.match(sql, /p\.donor_id\s*=\s*caller_id/i);
  assert.match(sql, /p\.status\s*=\s*'captured'/i);
});

test('legacy gifts require verified source provenance and a donor-to-auth identity mapping', () => {
  assert.match(sql, /s\.entity_type\s*=\s*'Donation'/i);
  assert.match(sql, /s\.source_verified\s+IS\s+TRUE/i);
  assert.match(sql, /source_user\.legacy_id\s*=\s*d\.donor_user_id/i);
  assert.match(sql, /s\.source_payload\s*->>\s*'donor_user_id'\s*=\s*d\.donor_user_id/i);
  assert.match(sql, /s\.source_payload\s*->>\s*'payment_verified'\s*=\s*'true'/i);
  assert.match(sql, /s\.source_payload\s*->>\s*'amount'/i);
});

test('RPC grants execute only to authenticated and omits provider references from its return contract', () => {
  assert.match(sql, /REVOKE\s+ALL\s+ON\s+FUNCTION\s+public\.ifund_my_giving\(\)\s+FROM\s+PUBLIC,\s*anon,\s*authenticated,\s*service_role/i);
  assert.match(sql, /GRANT\s+EXECUTE\s+ON\s+FUNCTION\s+public\.ifund_my_giving\(\)\s+TO\s+authenticated/i);
  const returnContract = sql.match(/RETURNS\s+TABLE\s*\(([\s\S]*?)\)\s*LANGUAGE/i)?.[1] || '';
  assert.doesNotMatch(returnContract, /paypal_order_id|paypal_capture_id|provider_transaction_id|canonical_operation_id|stripe_session_id/i);
  assert.match(sql, /LIMIT\s+1001/i);
});

test('migration has preflight checks for the private RLS-denied source tables', () => {
  assert.match(sql, /deny_clients_donation/i);
  assert.match(sql, /deny_clients_user/i);
  assert.match(sql, /deny_clients_source_snapshots/i);
  assert.match(sql, /ifund_donations_donor_captured_select/i);
  assert.match(sql, /has_column_privilege\('authenticated', 'public\.ifund_donations', 'paypal_order_id'/i);
  assert.match(sql, /relrowsecurity\s+IS\s+TRUE/i);
});
