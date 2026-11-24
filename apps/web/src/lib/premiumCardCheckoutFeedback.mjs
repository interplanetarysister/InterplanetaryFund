// Never infer payment success from PayPal card field events alone.
// A hosted-field validation failure has not created a payment order.
// Once an order exists, reconcile before another charge attempt.
export function premiumCardErrorMessage({stage="fields",providerCode="",hasOrder=false}={}){
  const code=String(providerCode||"").toUpperCase().replace(/[^A-Z0-9_]/g,"").slice(0,64);
  if(stage==="invalid"||["INVALID_CARD","VALIDATION_ERROR","CARD_FIELDS_VALIDATION_ERROR"].includes(code))
    return "Check the card number, expiration date, security code and cardholder name. No payment has been submitted.";
  if(!hasOrder){
    if(stage==="create"||stage==="checkout")
      return "The secure card checkout could not start a payment. Check your sign-in and account verification, then try again.";
    return "PayPal could not submit the card fields. Review the highlighted card information and try again. No payment order was created.";
  }
  if(code==="INSTRUMENT_DECLINED"||code==="PAYER_ACTION_REQUIRED")
    return "PayPal could not authorize this card. Check purchase status before using a different payment method.";
  return "PayPal returned an unresolved checkout result. Check your Premium purchase status before trying another payment so you aren't charged twice.";
}
export function premiumPurchaseState(purchase){
 if(!purchase||typeof purchase!=="object")return "none";
 const status=String(purchase.status||"");
 if(status==="captured"&&typeof purchase.valid_until==="string"&&Date.parse(purchase.valid_until)>Date.now())
   return "active";
 if(["created","initiated"].includes(status))return "pending";
 if(["refunded","reversed"].includes(status))return "reversed";
 return "none";
}
