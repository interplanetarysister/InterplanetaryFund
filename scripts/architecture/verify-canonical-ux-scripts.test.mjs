import test from 'node:test';
import assert from 'node:assert/strict';
import { assertCanonicalUxScripts, requiredUxScripts } from './verify-canonical-ux-scripts.mjs';

test('accepts all original UX acceptance scripts', () => {
  const scripts = Object.fromEntries(requiredUxScripts.map(name => [name, 'node scripts/check.mjs']));
  assert.deepEqual(assertCanonicalUxScripts({ scripts }), requiredUxScripts);
});
test('rejects missing scripts', () => {
  const scripts = Object.fromEntries(requiredUxScripts.slice(1).map(name => [name, 'node check.mjs']));
  assert.throws(() => assertCanonicalUxScripts({ scripts }), /verify:campaign-creation/);
});
test('rejects blank scripts', () => {
  const scripts = Object.fromEntries(requiredUxScripts.map(name => [name, 'node check.mjs']));
  scripts['verify:browser-render'] = ' ';
  assert.throws(() => assertCanonicalUxScripts({ scripts }), /verify:browser-render/);
});
test('rejects missing scripts object', () => {
  assert.throws(() => assertCanonicalUxScripts({}), /scripts object/);
});
