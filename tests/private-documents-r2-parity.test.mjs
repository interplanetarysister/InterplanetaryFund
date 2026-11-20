import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const client = read('apps/web/src/api/campaignDocuments.js');
const erasure = read('worker/services/privateDocumentErasure.js');

// Production source of truth as checked against Supabase's 2026-11-19 catalog:
// public.ifund_campaign_documents requires immutable R2 receipts, and no
// ifund-campaign-documents Supabase Storage bucket exists. These tests MUST
// remain red until the actual owner-authorized R2 Worker upload and verified
// erasure paths are implemented. Do not create the old Storage bucket to pass.
test('private document uploads use owner-authorized R2 receipts, not Supabase Storage', () => {
  assert.doesNotMatch(client, /client\.storage\.from\s*\(\s*DOCUMENT_BUCKET\s*\)/,
    'Client still writes or reads the obsolete Supabase Storage bucket');
  for (const field of ['object_etag', 'object_sha256', 'object_verified_at']) {
    assert.match(client, new RegExp(field),
      'Missing immutable R2 verification field: ' + field);
  }
});
test('privileged private-document erasure does not reference obsolete Storage object endpoints', () => {
  assert.doesNotMatch(erasure, /\/storage\/v1\/object\//,
    'Erasure still calls Supabase Storage instead of verifying R2 deletion');
});
test('document backend safety flags and fail-closed defaults remain mandatory', () => {
  assert.match(erasure, /IFUND_DOCUMENT_ERASURE_ENABLED/);
  assert.match(erasure, /!==\s*["']enabled["']/);
  assert.match(client, /allow_agent_use:allowAgentUse/);
});
