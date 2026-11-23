// Selecting PayPal or Google Pay defaults the choice to automatic renewal.
// A selection is never authorization to charge; the buyer must explicitly
// approve the disclosed $4.99/month agreement with the payment provider.
export const BILLING_METHODS=Object.freeze(["paypal","googlepay","card"]);
export const BILLING_MODES=Object.freeze(["recurring","one_time"]);
export function initialBillingChoice(method="paypal"){
  return {method,mode:method==="paypal"||method==="googlepay"?"recurring":"one_time"};
}
export function chooseBillingMethod(current,method){
  if(!BILLING_METHODS.includes(method))return current;
  return initialBillingChoice(method);
}
export function chooseBillingMode(current,mode){
  if(!BILLING_MODES.includes(mode))return current;
  return {...current,mode};
}
export function canBeginBilling({choice,authenticated,verifiedPlan,native,providerReady,oneTimeReady,googleRecurringReady}){
  if(native||!authenticated||!verifiedPlan)return false;
  if(choice.mode==="one_time")return oneTimeReady===true;
  if(choice.method==="googlepay")return googleRecurringReady===true&&providerReady===true;
  return providerReady===true;
}
