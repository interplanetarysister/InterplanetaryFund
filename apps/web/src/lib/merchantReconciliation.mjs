// ORBIT: advisory-only integrity checks for already authorized merchant receipts.
// Never allocates, refunds, captures, or settles payments.
function cents(value) {
  if(value===null||value===undefined||value===""||typeof value==="boolean")return null;
  if(typeof value==="string"&&!/^(0|[1-9]\d*)$/.test(value))return null;
  const number=Number(value);
  return Number.isSafeInteger(number)&&number>=0?number:null;
}
export function merchantReceiptExceptions(receipts) {
  if(!Array.isArray(receipts))return null;
  const exceptions=[];
  const counts=new Map();
  for(const r of receipts) {
    const id=typeof r?.paypal_transaction_id==="string"?r.paypal_transaction_id.trim():"";
    if(id)counts.set(id,(counts.get(id)||0)+1);
  }
  for(const r of receipts) {
    const id=typeof r?.paypal_transaction_id==="string"?r.paypal_transaction_id:"Unavailable";
    const issues=[];
    if(id==="Unavailable"||!id.trim())issues.push("Missing PayPal transaction identifier");
    else if((counts.get(id.trim())||0)>1)issues.push("Duplicate PayPal transaction identifier in merchant receipts");
    const gross=cents(r?.gross_cents),fee=cents(r?.processing_fee_cents),net=cents(r?.net_cents);
    if(gross===null||fee===null||net===null)issues.push("Missing or invalid verified cent amounts");
    else if(fee>gross || gross-fee!==net)issues.push("Gross, processor fee and net totals do not reconcile");
    if(!r?.source_site||r.source_site==="unattributed")issues.push("Originating site not independently verified");
    if(r?.allocation_status==="unattributed")issues.push("Merchant receipt has no verified allocation");
    if(issues.length)exceptions.push({id,issues});
  }
  return exceptions;
}
