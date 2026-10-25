import test from 'node:test';
import assert from 'node:assert/strict';
import { validateCampaign, canSaveCampaign } from '../src/lib/validation.js';
test('partial draft can always save', () => assert.deepEqual(validateCampaign({ title: '' }, false), []));
test('incomplete campaign cannot publish', () => assert.ok(validateCampaign({ title: 'Hello', goal_amount: 0 }, true).length >= 3));
test('complete campaign can publish', () => assert.deepEqual(validateCampaign({ title: 'What if', summary: 'Some summary', story: 'Long campaign story', goal_amount: '100' }, true), []));

test('new campaign can save without existing record load', () => assert.equal(canSaveCampaign({ id: undefined, loadedId: null, loadState: 'ready', busy: false }), true));
test('existing campaign cannot save before load', () => assert.equal(canSaveCampaign({ id: 'a', loadedId: null, loadState: 'loading', busy: false }), false));
test('existing campaign cannot save after load error', () => assert.equal(canSaveCampaign({ id: 'a', loadedId: null, loadState: 'error', busy: false }), false));
test('existing campaign cannot save a stale previously loaded record', () => assert.equal(canSaveCampaign({ id: 'new', loadedId: 'old', loadState: 'ready', busy: false }), false));
test('existing campaign can save only after matching load succeeds', () => assert.equal(canSaveCampaign({ id: 'same', loadedId: 'same', loadState: 'ready', busy: false }), true));
test('submitting campaign twice concurrently is blocked', () => assert.equal(canSaveCampaign({ id: 'same', loadedId: 'same', loadState: 'ready', busy: true }), false));
