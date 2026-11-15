import test from "node:test";
import assert from "node:assert/strict";
import { parseDonationCents } from "../src/lib/donationAmount.mjs";

test("canonical donation amounts preserve exact cents", () => {
  for (const [input, expected] of [["1",100],["2.50",250],["3.33",333],["5.00",500],["10",1000],["25",2500],["1000000.00",100000000]]) {
    assert.equal(parseDonationCents(input),expected,input);
  }
});
test("reject fractional cents, exponent notation, negative and invalid input", () => {
  for (const input of ["1.005","1e2","", " ", "-1","NaN","Infinity","0.99","1000000.01","1000001","01","1.",".50","1,000","1.2.3","1.234","1e+2"]) {
    assert.equal(parseDonationCents(input),null,input);
  }
});
test("non-string amounts cannot silently bypass donor input validation",()=>{
  for (const input of [null,undefined,1,1.005,{},[]]) assert.equal(parseDonationCents(input),null);
});

test("synthetic exhaustive cent-to-decimal round trips across supported donation bounds", () => {
  // Pure arithmetic fixtures only: never call checkout or write a financial record.
  for (let cents = 100; cents <= 100000000; cents += 9973) {
    const canonical = (cents / 100).toFixed(2);
    assert.equal(parseDonationCents(canonical), cents, canonical);
  }
  assert.equal(parseDonationCents("1000000.00"), 100000000);
  assert.equal(parseDonationCents("1000000.01"), null);
});
test("synthetic parser rejects whitespace, Unicode digits, coercion and malformed decimals", () => {
  for (const input of [
    " 1", "1 ", "\n1", "1\n", "\t1", "+1", "1.000", "1.01.0",
    "1_000", "1,000", "$1.00", "1 USD", "٠١", "１２", "1٫00",
    "\u200b1", "1\u00a0", "1\u202e", "0001", "1e0", "0x10",
    "99999999", "9999999.99", new String("1"), true, false, 100n
  ]) assert.equal(parseDonationCents(input), null, String(input));
});
