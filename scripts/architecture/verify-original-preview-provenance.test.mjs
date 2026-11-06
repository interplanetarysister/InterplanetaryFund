import test from 'node:test';
import assert from 'node:assert/strict';
import { assertOriginalPreviewProvenance, validatePreviewOrigin } from './verify-original-preview-provenance.mjs';
const sha = 'a'.repeat(40);
const valid = { source_repository: 'interplanetarysister/interplanetary-fund2', source_commit: sha, runtime: 'base44-preserved', release: 'preview-only' };
test('accepts exact immutable original source preview', () => assert.equal(assertOriginalPreviewProvenance(valid, sha.toUpperCase()), true));
test('rejects reconstructed frontend or replaced runtime', () => {
  for (const patch of [{source_repository:'interplanetarysister/InterplanetaryFund'}, {runtime:'supabase'}, {release:'production'}, {source_commit:'b'.repeat(40)}])
    assert.throws(() => assertOriginalPreviewProvenance({...valid,...patch},sha));
});
test('requires exact source SHA', () => assert.throws(() => assertOriginalPreviewProvenance(valid,'main')));
test('accepts isolated Pages preview only', () => {
  assert.equal(validatePreviewOrigin('https://abc.interplanetaryfund-migration.pages.dev/').hostname,'abc.interplanetaryfund-migration.pages.dev');
  for (const url of ['https://interplanetaryfund.com/','https://evilinterplanetaryfund-migration.pages.dev/','http://abc.interplanetaryfund-migration.pages.dev/','https://abc.interplanetaryfund-migration.pages.dev/other','https://abc.interplanetaryfund-migration.pages.dev/?x=1'])
    assert.throws(() => validatePreviewOrigin(url));
});
