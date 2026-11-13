// POLARIS: local budget math in integer cents; no payment or payout operations.
// The platform currently assesses a 7% fee at withdrawal; the provider's
// processing fees and available cleared balance are not inferred here.
export const PLATFORM_WITHDRAWAL_FEE_RATE=0.07;
export function moneyToCents(value) {
  if(typeof value!=="string"&&typeof value!=="number")return null;
  const t=String(value).trim();
  if(!/^(0|[1-9]\d*)(?:\.\d{1,2})?$/.test(t))return null;
  const [whole,fraction=""]=t.split(".");
  const cents=Number(whole)*100+Number(fraction.padEnd(2,"0"));
  return Number.isSafeInteger(cents)&&cents>=0?cents:null;
}
export function planCampaignBudget(items) {
  if(!Array.isArray(items)||items.length>50)return {ready:false,error:"Too many budget items.",items:[]};
  const normalized=[];
  let target=0;
  for(const item of items){
    if(!item||typeof item.label!=="string"||item.label.trim().length<2||item.label.length>100)return {ready:false,error:"Every budget item needs a short label.",items:[]};
    const cents=moneyToCents(item.amount);
    if(cents===null)return {ready:false,error:"Enter valid nonnegative USD amounts with at most two decimals.",items:[]};
    if(!Number.isSafeInteger(target+cents))return {ready:false,error:"Budget total is too large.",items:[]};
    normalized.push({label:item.label.trim(),cents});
    target+=cents;
  }
  if(target===0)return {ready:false,error:"Add at least one positive cost.",items:normalized};
  // 93% of gross is available after the 7% platform fee, before other fees.
  const suggestedGrossCents=Math.ceil(target/0.93);
  const platformFeeEstimateCents=Math.round(suggestedGrossCents*PLATFORM_WITHDRAWAL_FEE_RATE);
  return {ready:true,items:normalized,targetCents:target,suggestedGrossCents,platformFeeEstimateCents,
    disclaimer:"Planning estimate only; processor fees, refunds, withheld funds and payout eligibility can change the actual available amount."};
}
