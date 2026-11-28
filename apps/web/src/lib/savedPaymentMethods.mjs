// Saved payment methods are PayPal Vault v3 token references. The browser
// only ever sees display descriptors (brand, last four digits, expiry,
// cardholder name) — never a card number, a CVV, or the PayPal payment
// token id itself. These helpers validate and present those descriptors.
export function isSavedMethodDescriptor(value){
  return Boolean(value&&typeof value==="object"
    &&typeof value.id==="string"&&value.id.length>0
    &&typeof value.brand==="string"&&value.brand.length>0
    &&typeof value.last4==="string"&&/^[0-9]{4}$/.test(value.last4)
    &&Number.isSafeInteger(value.expiry_month)&&value.expiry_month>=1&&value.expiry_month<=12
    &&Number.isSafeInteger(value.expiry_year)&&value.expiry_year>=2024&&value.expiry_year<=2100
    &&(value.cardholder_name===null||value.cardholder_name===undefined||typeof value.cardholder_name==="string")
    &&(value.is_default===undefined||typeof value.is_default==="boolean"));
}
export function savedMethodsFromResponse(data){
  if(!data||data.ok!==true||!Array.isArray(data.methods))return [];
  return sortSavedMethods(data.methods.filter(isSavedMethodDescriptor));
}
export function sortSavedMethods(methods){
  return [...methods].sort((a,b)=>{
    if(Boolean(a.is_default)!==Boolean(b.is_default))return a.is_default?-1:1;
    return String(b.created_at||"").localeCompare(String(a.created_at||""));
  });
}
export function formatSavedCard(method){
  if(!isSavedMethodDescriptor(method))return "Saved card";
  return method.brand+" •••• "+method.last4;
}
export function savedCardExpiry(method){
  if(!isSavedMethodDescriptor(method))return "";
  return "Expires "+String(method.expiry_month).padStart(2,"0")+"/"+method.expiry_year;
}
