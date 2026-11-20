const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ALLOW=new Set(["www.paypal.com","paypal.com"]);
async function memberAccess(client){
 const [auth,session]=await Promise.all([client.auth.getUser(),client.auth.getSession()]);
 const user=auth.data?.user;
 const token=session.data?.session?.access_token;
 if(auth.error||session.error||!UUID.test(user?.id||"")||
   !user.email_confirmed_at||user.is_anonymous===true||
   session.data?.session?.user?.id!==user.id||
   typeof token!=="string"||token.length<40)
  throw new Error("Your verified member session is required for recurring billing.");
 return {token,ownerId:user.id};
}
/** The recurring checkout is separate from address reservation and membership. */
export async function readRecurringEmailCheckoutService(client,fetcher=fetch){
 const {token}=await memberAccess(client);
 const res=await fetcher("/api/payments/email-addon/status",{
  headers:{Authorization:"Bearer "+token},cache:"no-store"});
 if(!res.ok)throw new Error("Recurring PayPal checkout is unavailable.");
 const data=await res.json();
 if(!data||data.ok!==true||typeof data.checkout_ready!=="boolean"||
   data.monthly_amount_cents!==100||data.currency!=="USD"||
   data.interval!=="monthly"||data.provider!=="paypal"||
   data.activation_requires_completed_sale!==true)
  throw new Error("Recurring PayPal checkout status could not be verified.");
 return data;
}
export async function beginRecurringEmailCheckout(client,{requestId,fetcher=fetch}={}){
 if(!UUID.test(requestId||""))throw new Error("Invalid recurring checkout reference.");
 const {token}=await memberAccess(client);
 const readiness=await readRecurringEmailCheckoutService(client,fetcher);
 if(!readiness.checkout_ready)throw new Error("The recurring $1 PayPal plan is not ready.");
 const res=await fetcher("/api/payments/email-addon/start",{
  method:"POST",headers:{Authorization:"Bearer "+token,"content-type":"application/json"},
  body:JSON.stringify({request_id:requestId}),cache:"no-store"});
 if(!res.ok)throw new Error("PayPal could not prepare this recurring subscription. No mailbox has been activated.");
 const data=await res.json();
 if(data?.ok!==true||data?.addon_active!==false||
   data?.monthly_amount_cents!==100||typeof data.approval_url!=="string"||
   !/^I-[A-Z0-9]{10,30}$/.test(data.subscription_id||""))
  throw new Error("PayPal did not return a verified subscription agreement.");
 let approval;
 try{approval=new URL(data.approval_url);}
 catch{throw new Error("Invalid PayPal approval destination.");}
 if(approval.protocol!=="https:"||!ALLOW.has(approval.hostname))
  throw new Error("PayPal approval destination could not be verified.");
 return {approvalUrl:approval.toString(),subscriptionId:data.subscription_id};
}
