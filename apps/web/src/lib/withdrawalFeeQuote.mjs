/** Informational 7% platform withdrawal fee estimate; never mutates a payout. */
export function quoteWithdrawalFee(input) {
  const text=String(input ?? "").trim();
  if(!/^(?:0|[1-9]\d{0,8})(?:\.\d{1,2})?$/.test(text))return null;
  const [dollars,cents=""]=text.split(".");
  const gross=BigInt(dollars)*100n+BigInt(cents.padEnd(2,"0"));
  if(gross<1n||gross>100000000000n)return null;
  // Matches round(gross_cents * 0.07), half-up for nonnegative amounts.
  const fee=(gross*7n+50n)/100n;
  const net=gross-fee;
  return {gross_cents:Number(gross),platform_fee_cents:Number(fee),estimated_owner_cents:Number(net)};
}
