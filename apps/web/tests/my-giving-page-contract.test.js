import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const page = readFileSync(new URL('../src/pages/MyGiving.jsx', import.meta.url), 'utf8');

test('My Giving uses the canonical API and does not encode a PayPal-only product limitation', () => {
  assert.match(page, /fetch\("\/api\/me\/giving"/);
  assert.match(page, /Only verified donations are included/);
  assert.doesNotMatch(page, /Only PayPal donations/);
  assert.match(page, /paymentLabel\(donation\.payment_method\)/);
});

test('My Giving preserves historical campaign IDs without generating invalid campaign links', () => {
  assert.match(page, /CAMPAIGN_UUID\.test\(String\(id \|\| ""\)\)/);
  assert.match(page, /function CampaignName/);
  assert.match(page, /Date unavailable/);
});

test('My Giving displays source recurring, support, and available fee totals', () => {
  assert.match(page, /is_recurring/);
  assert.match(page, /Monthly Giving/);
  assert.match(page, /Recurring gifts/);
  assert.match(page, /Optional IFund support/);
  assert.match(page, /Processor fee/);
  assert.match(page, /Total charged/);
});
