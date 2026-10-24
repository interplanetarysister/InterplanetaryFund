import test from 'node:test';
import assert from 'node:assert/strict';
import { validateCampaign } from '../src/lib/validation.js';
test('partial draft can always save', () => assert.deepEqual(validateCampaign({ title: '' }, false), []));
test('incomplete campaign cannot publish', () => assert.ok(validateCampaign({ title: 'Hello', goal_amount: 0 }, true).length >= 3));
test('complete campaign can publish', () => assert.deepEqual(validateCampaign({ title: 'What if', summary: 'Some summary', story: 'Long campaign story', goal_amount: '100' }, true), []));
