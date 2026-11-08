import test from 'node:test';
import assert from 'node:assert/strict';
import { helpArticleBySlug } from '../src/lib/helpArticles.js';

test('withdrawal help uses the approved 7% fee without implying payouts are live', () => {
  const article = helpArticleBySlug('payment-holding-and-withdrawals');
  assert.ok(article, 'withdrawal article must exist');
  assert.match(article.answer, /7% platform fee is deducted at withdrawal/);
  assert.doesNotMatch(article.answer, /(?:planned\s+)?3% platform fee/i);
  assert.match(article.answer, /Withdrawal is not currently enabled/);
  assert.match(article.answer, /processor fees separately disclosed/);
});
