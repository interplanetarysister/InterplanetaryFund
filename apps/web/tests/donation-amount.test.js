import test from 'node:test';
import assert from 'node:assert/strict';
import { parseDonationCents } from '../src/lib/donationAmount.mjs';

test('donation inputs retain exact cents across the full supported range', () => {
  for (const [input, expected] of [['1', 100], ['1.01', 101], ['2.50', 250], ['3.33', 333], ['1000000.00', 100000000]]) {
    assert.equal(parseDonationCents(input), expected);
  }
  for (let cents = 100; cents <= 100000000; cents += 9973) {
    assert.equal(parseDonationCents((cents / 100).toFixed(2)), cents);
  }
});
test('fractional cents, coercion, overflow and noncanonical amounts cannot become charges', () => {
  for (const input of ['1.005', '1e2', '', ' ', '-1', 'NaN', 'Infinity', '0.99', '1000000.01', '1000001',
    '01', '1.', '.50', '1,000', '1.2.3', '1.234', ' 1', '1 ', '\n1', '1\n', '+1', '0x10', '$1.00',
    '٠١', '１２', '\u200b1', null, undefined, 1, {}, [], new String('1'), true, 100n]) {
    assert.equal(parseDonationCents(input), null, String(input));
  }
});
