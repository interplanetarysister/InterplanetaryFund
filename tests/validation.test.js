import test from 'node:test';
import assert from 'node:assert/strict';
import { validateCampaign, canSaveCampaign } from '../src/lib/validation.js';
test('partial draft can always save', () => assert.deepEqual(validateCampaign({ title: '' }, false), []));
test('incomplete campaign cannot publish', () => assert.ok(validateCampaign({ title: 'Hello', goal_amount: 0 }, true).length >= 2));
test('complete campaign can publish', () => assert.deepEqual(validateCampaign({ title: 'What if', summary: 'Some summary', story: 'Long campaign story', goal_amount: '100' }, true), []));

test('new campaign can save without existing record load', () => assert.equal(canSaveCampaign({ id: undefined, loadedId: null, loadState: 'ready', busy: false }), true));
test('existing campaign cannot save before load', () => assert.equal(canSaveCampaign({ id: 'a', loadedId: null, loadState: 'loading', busy: false }), false));
test('existing campaign cannot save after load error', () => assert.equal(canSaveCampaign({ id: 'a', loadedId: null, loadState: 'error', busy: false }), false));
test('existing campaign cannot save a stale previously loaded record', () => assert.equal(canSaveCampaign({ id: 'new', loadedId: 'old', loadState: 'ready', busy: false }), false));
test('existing campaign can save only after matching load succeeds', () => assert.equal(canSaveCampaign({ id: 'same', loadedId: 'same', loadState: 'ready', busy: false }), true));
test('submitting campaign twice concurrently is blocked', () => assert.equal(canSaveCampaign({ id: 'same', loadedId: 'same', loadState: 'ready', busy: true }), false));

test('creator may publish with a summary instead of a longer story', () =>
  assert.deepEqual(validateCampaign({ title: 'Support the project', summary: 'A verified purpose', story: '', goal_amount: '500' }, true), []));
test('creator may publish with a story and leave the short summary blank', () =>
  assert.deepEqual(validateCampaign({ title: 'Support the project', summary: '', story: 'An authentic story about the need', goal_amount: '500' }, true), []));
test('a draft does not require campaign content', () =>
  assert.deepEqual(validateCampaign({ title: '', summary: '', story: '', goal_amount: '' }, false), []));
test('invalid goal values cannot be published', () => {
  for (const goal_amount of ['', '-1', '0', 'NaN', 'Infinity']) {
    assert.ok(validateCampaign({ title: 'Valid title', summary: 'Valid summary', goal_amount }, true).length);
  }
});
test('new campaign cannot save while the editor is unavailable', () =>
  assert.equal(canSaveCampaign({ id: undefined, loadedId: null, loadState: 'error', busy: false }), false));
