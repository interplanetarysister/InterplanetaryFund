import {useEffect,useRef,useState} from "react";
import {authClient} from "@/api/auth";
import {CreditCard,ShieldCheck,Loader2} from "lucide-react";
import {isNativeBundle} from "@/lib/nativeApi";
import {premiumCardErrorMessage,premiumPurchaseState} from "@/lib/premiumCardCheckoutFeedback.mjs";

const API="/api/payments/premium-one-time";
// A dedicated SDK namespace prevents the subscription card form from using
// the donation widget's SDK instance, which may have different components,
// merchant settings, or purchase intent.
const PREMIUM_SDK_NAMESPACE="ifundPremiumPayPal";
let scriptPromise,scriptClient;
function loadPayPal(clientId){
  if(scriptPromise)return scriptClient===clientId?scriptPromise:Promise.reject(Error("PayPal merchant changed. Reload checkout."));
  scriptClient=clientId;
  scriptPromise=new Promise((resolve,reject)=>{
    if(window[PREMIUM_SDK_NAMESPACE]?.Buttons&&window[PREMIUM_SDK_NAMESPACE]?.CardFields){
      resolve(window[PREMIUM_SDK_NAMESPACE]);return;
    }
    const script=document.createElement("script");
    script.setAttribute("data-namespace",PREMIUM_SDK_NAMESPACE);
    script.src="https://www.paypal.com/sdk/js?client-id="+encodeURIComponent(clientId)+
      "&components=buttons,card-fields&currency=USD&intent=capture";
    script.async=true;
    script.onload=()=>window[PREMIUM_SDK_NAMESPACE]?.CardFields&&window[PREMIUM_SDK_NAMESPACE]?.Buttons
      ?resolve(window[PREMIUM_SDK_NAMESPACE]):reject(Error("PayPal Card Fields SDK unavailable"));
    script.onerror=()=>reject(Error("PayPal Card Fields SDK unavailable"));
    document.head.appendChild(script);
  }).catch(error=>{scriptPromise=null;scriptClient=null;throw error});
  return scriptPromise;
}
async function api(path,options={}){
  const response=await fetch(path,{...options,cache:"no-store"});
  const data=await response.json().catch(()=>({}));
  if(!response.ok||data.ok===false){
    const reason=typeof data.error==="string"?data.error:"premium_checkout_unavailable";
    const failure=new Error("Premium checkout could not complete the requested step.");
    failure.code=reason;
    failure.httpStatus=response.status;
    throw failure;
  }
  return data;
}
async function memberToken(){
  const {data,error}=await authClient().auth.getSession();
  if(error||!data?.session?.access_token)throw Error("Sign in to purchase Premium.");
  return data.session.access_token;
}
export default function PremiumOneTimeCheckout({method,activeSubscription=false}){
  const [ready,setReady]=useState(false),[busy,setBusy]=useState(false);
  const [sdkReady,setSdkReady]=useState(false),[cardReady,setCardReady]=useState(false);
  const [error,setError]=useState(""),[complete,setComplete]=useState(null);
  const [statusChecking,setStatusChecking]=useState(false);
  const [readinessRetry,setReadinessRetry]=useState(0);
  const [readinessChecking,setReadinessChecking]=useState(true);
  const [checkoutPhase,setCheckoutPhase]=useState("idle");
  const [purchaseState,setPurchaseState]=useState("none");
  const nameHost=useRef(null),numberHost=useRef(null),expiryHost=useRef(null),cvvHost=useRef(null);
  const paypalHost=useRef(null),cardSession=useRef(null),intent=useRef(null);
  const submitting=useRef(false);
  const native=isNativeBundle();

  async function checkPurchaseStatus(){
    setStatusChecking(true);setError("");
    try{
      const response=await api(API+"/status",{headers:{authorization:"Bearer "+await memberToken()}});
      const purchase=response.purchase;
      const state=premiumPurchaseState(purchase);
      setPurchaseState(state);
      if(state==="active"){
        setComplete(purchase.valid_until);
        intent.current=null;
        setCheckoutPhase("completed");
      }else if(state==="pending"){
        setError("Your earlier Premium checkout has not been confirmed. Do not submit another payment. Verify the receipt with PayPal or contact support before retrying.");
      }else if(state==="reversed"){
        setError("The most recent Premium payment was reversed or refunded. No Premium access was granted for that purchase.");
      }else{
        setError("No completed Premium purchase is recorded for this account. If PayPal showed a charge, contact support with the PayPal receipt before paying again.");
      }
      return state;
    }catch(_){
      setError("Purchase status could not be verified right now. If PayPal may have charged you, do not submit another payment until the status can be checked.");
      return "unknown";
    }finally{setStatusChecking(false)}
  }

  useEffect(()=>{
    let mounted=true;
    if(native||activeSubscription){setReady(false);setReadinessChecking(false);return;}
    setReadinessChecking(true);
    memberToken().then(token=>api(API+"/readiness",{
      headers:{authorization:"Bearer "+token}
    })).then(v=>{
      if(mounted)setReady(v.ready===true&&v.auto_renews===false&&v.amount_cents===499&&v.currency==="USD");
    }).catch(()=>{if(mounted)setReady(false)})
      .finally(()=>{if(mounted)setReadinessChecking(false)});
    return()=>{mounted=false;};
  },[activeSubscription,native,readinessRetry]);

  useEffect(()=>{
    if(!ready||native||activeSubscription||complete||method==="googlepay")return;
    let disposed=false,buttons=null,card=null;
    setSdkReady(false);setCardReady(false);setError("");
    (async()=>{
      try{
        const cfg=await api("/api/payments/config");
        if(cfg.environment!=="live"||!cfg.client_id)throw Error("Live card checkout unavailable");
        const paypal=await loadPayPal(cfg.client_id);
        if(disposed)return;
        async function createOrder(channel){
          if(intent.current?.orderId)return intent.current.orderId;
          const token=crypto.randomUUID().replaceAll("-","")+crypto.randomUUID().replaceAll("-","");
          const requestKey=crypto.randomUUID();
          let response;
          try{
            response=await api(API+"/create-order",{
              method:"POST",headers:{"content-type":"application/json",
                authorization:"Bearer "+await memberToken()},
              body:JSON.stringify({request_key:requestKey,checkout_token:token,
                payment_channel:channel,amount_cents:499,currency:"USD"})
            });
          }catch(cause){
            if(!disposed){setCheckoutPhase("create-error");setError(premiumCardErrorMessage({stage:"create",providerCode:cause?.code,hasOrder:false}));}
            throw cause;
          }
          if(!response.id||response.amount_cents!==499||response.currency!=="USD")
            throw Error("PayPal order does not match the one-month purchase.");
          intent.current={orderId:response.id,token};
          if(!disposed){setCheckoutPhase("order-created");setPurchaseState("pending");}
          return response.id;
        }
        async function onApprove(data){
          if(disposed)return;
          if(!intent.current||data?.orderID!==intent.current.orderId){
            setCheckoutPhase("review");
            setError("PayPal returned an unexpected order reference. No access was granted. Check your purchase status before trying again.");
            return;
          }
          setBusy(true);
          try{
            const result=await api(API+"/capture-order",{
              method:"POST",headers:{"content-type":"application/json",
                authorization:"Bearer "+await memberToken()},
              body:JSON.stringify({order_id:intent.current.orderId,checkout_token:intent.current.token})
            });
            if(result.ok!==true||result.status!=="captured"||!result.valid_until)
              throw Error("Payment receipt was not verified. Check account status before retrying.");
            setComplete(result.valid_until);
            setPurchaseState("active");
            setCheckoutPhase("completed");
            intent.current=null;
          }catch(_){
            if(!disposed){setCheckoutPhase("review");setError(premiumCardErrorMessage({stage:"capture",hasOrder:true}));}
            // Do not re-capture or start a second order if PayPal may have charged.
            if(!disposed)void checkPurchaseStatus();
          }
          finally{if(!disposed)setBusy(false)}
        }
        // A hidden PayPal button can fail iframe rendering and prevent card
        // fields from initializing. Render buttons only on the PayPal tab.
        if(method==="paypal"){
          buttons=paypal.Buttons({createOrder:()=>createOrder("paypal"),onApprove,
            onCancel:()=>{if(!disposed)setBusy(false)},
            onError:()=>{if(!disposed){setCheckoutPhase("review");setError(premiumCardErrorMessage({stage:"checkout",hasOrder:Boolean(intent.current?.orderId)}));}},
            style:{layout:"vertical",label:"paypal",shape:"rect"}});
          if(paypalHost.current)await buttons.render(paypalHost.current);
        }
        if(disposed)return;
        if(method==="card"&&typeof paypal.CardFields==="function"){
          card=paypal.CardFields({
            createOrder:()=>createOrder("card"),onApprove,
            onError:error=>{if(!disposed){setCheckoutPhase("card-error");setError(current=>current||premiumCardErrorMessage({stage:"card",providerCode:error?.code||error?.name,hasOrder:Boolean(intent.current?.orderId)}));}},
            onCancel:()=>{if(!disposed){setCheckoutPhase("review");setError("Card authentication was canceled. Check your purchase status before submitting another payment.");}}
          });
          if(card.isEligible()){
            cardSession.current=card;
            // NameField is optional in PayPal's merchant configurations.
            // A missing name component must never suppress the three required
            // hosted inputs or the card submission action.
            const hosted=[card.NumberField(),card.ExpiryField(),card.CVVField()];
            await Promise.all([
              hosted[0].render(numberHost.current),
              hosted[1].render(expiryHost.current),
              hosted[2].render(cvvHost.current)
            ]);
            if(typeof card.NameField==="function" && nameHost.current){
              try{await card.NameField().render(nameHost.current)}catch(_){/* optional */ }
            }
            if(!disposed)setCardReady(true);
          }
        }
        if(!disposed){
          if(method==="card"&&!cardReady&&(!card||!card.isEligible())){
            setError("PayPal did not enable direct card entry for this merchant or browser. You can still select PayPal checkout.");
          }
          setSdkReady(true);
        }
      }catch(_){if(!disposed){setCheckoutPhase("initialization-error");setError("Secure card checkout did not initialize. No payment has been started. Refresh the page or choose PayPal.");}}
    })();
    return()=>{
      disposed=true;
      try{buttons?.close?.()}catch(_){}
      cardSession.current=null;
      for(const node of [paypalHost.current,nameHost.current,numberHost.current,expiryHost.current,cvvHost.current]){
        try{node?.replaceChildren()}catch(_){}
      }
    };
  },[ready,method,native,activeSubscription,complete]);

  if(native)return <p className="text-xs text-muted-foreground">Purchases in the mobile app require separate store billing approval.</p>;
  if(activeSubscription)return <div className="mt-4 space-y-2">
    <button type="button" disabled aria-disabled="true"
      className="min-h-11 w-full rounded-xl bg-cyan-600 px-3 font-semibold text-white opacity-50">
      Pay $4.99 now — one month, no renewal
    </button>
    <p role="status" className="text-xs text-muted-foreground">
      Your existing Premium membership or account status must be verified before another payment.
      No new charge can be started.
    </p>
  </div>;
  if(method==="googlepay")return <p className="text-sm text-muted-foreground">One-time Google Pay enrollment is not yet verified for Premium. Choose card or PayPal.</p>;
  if(!ready)return <div className="mt-4 space-y-3">
    <button type="button" disabled aria-disabled="true"
      className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-cyan-600 px-3 font-semibold text-white opacity-50">
      <CreditCard className="h-4 w-4"/> Pay $4.99 now — one month, no renewal
    </button>
    <p role="status" className="text-sm text-muted-foreground">
      {readinessChecking?"Verifying secure card checkout…":"The payment provider or your account could not be verified. No payment was started."}
    </p>
    {!readinessChecking&&<button type="button" className="ifund-interactive min-h-11 rounded-xl border px-4 py-2 text-sm font-semibold"
      onClick={()=>setReadinessRetry(n=>n+1)}>Retry secure card checkout</button>}
  </div>;
  if(complete)return <div role="status" className="rounded-xl border border-emerald-500/30 p-4">
    <strong>One month of Premium verified.</strong>
    <p className="mt-1 text-sm">Access through {new Date(complete).toLocaleDateString()}. No future payments are scheduled.</p>
  </div>;
  const field="min-h-11 w-full rounded-lg border border-border bg-background px-2 py-2";
  return <div className="mt-4 space-y-3">
    <p className="text-sm font-semibold">{method==="card"?"Pay by card · $4.99 USD once":"Pay with PayPal · $4.99 USD once"}</p>
    <p className="text-xs text-muted-foreground">One month of access, no automatic renewal. You may buy another month manually after it expires.</p>
    {method==="card"&&<p className="text-xs text-muted-foreground">Visa, Mastercard, Discover, and American Express may be used when enabled by PayPal for this merchant and card. American Express cards have a four-digit security code. No PayPal account is needed for eligible direct card payments.</p>}
    {method==="card"&&<section aria-label="Secure one-time card fields" className="space-y-2">
      <label className="block text-xs">Cardholder name (if available)<div className={field} ref={nameHost}/></label>
      <label className="block text-xs">Card number<div className={field} ref={numberHost}/></label>
      <div className="grid grid-cols-2 gap-2">
        <label className="text-xs">Expiry<div className={field} ref={expiryHost}/></label>
        <label className="text-xs">Security code<div className={field} ref={cvvHost}/></label>
      </div>
      <button type="button" disabled={!cardReady||busy||statusChecking||submitting.current||purchaseState==="pending"} onClick={async()=>{
        if(submitting.current||!cardSession.current||intent.current?.orderId)return;
        setError("");setCheckoutPhase("validating");
        try{
          // PayPal CardFields checks the actual hosted, PCI-scoped inputs.
          // Incomplete/invalid fields have not created an order or charge.
          const state=await cardSession.current.getState();
          if(!state?.isFormValid){
            setCheckoutPhase("invalid");
            setError(premiumCardErrorMessage({stage:"invalid"}));
            return;
          }
          submitting.current=true;
          setBusy(true);setCheckoutPhase("submitting");
          await cardSession.current.submit();
        }catch(cause){
          const hasOrder=Boolean(intent.current?.orderId);
          setCheckoutPhase(hasOrder?"review":"invalid");
          setError(current=>current||premiumCardErrorMessage({stage:hasOrder?"capture":"fields",providerCode:cause?.code||cause?.name,hasOrder}));
        }finally{
          submitting.current=false;setBusy(false);
        }
      }} className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-cyan-600 px-3 font-semibold text-white disabled:opacity-50">
        {busy?<Loader2 className="h-4 w-4 animate-spin"/>:<CreditCard className="h-4 w-4"/>}
        {busy?"Processing secure card payment…":"Pay $4.99 by card now"}
      </button>
      {!cardReady&&<p role="status" className="text-xs text-muted-foreground">
        {sdkReady
          ?"Direct card fields are not enabled for this merchant or browser. PayPal controls card eligibility."
          :"Secure card form is loading. The payment button will activate only after card fields are available."}
      </p>}
    </section>}
    {method==="paypal"&&!sdkReady&&<button type="button" disabled aria-disabled="true"
      className="min-h-11 w-full rounded-xl bg-cyan-600 px-3 font-semibold text-white opacity-50">
      Continue with PayPal — pay $4.99 once
    </button>}
    <div ref={paypalHost} style={{display:method==="paypal"?"block":"none"}} aria-label="One-time PayPal payment" className="min-h-11"/>
    {method==="paypal"&&!sdkReady&&<p role="status" className="text-xs text-muted-foreground">
      The secure PayPal payment button is loading. Payment cannot begin until PayPal is available.
    </p>}
    <p className="flex items-start gap-2 text-xs text-muted-foreground">
      <ShieldCheck className="h-4 w-4 shrink-0"/>Card details are hosted securely by PayPal. A PayPal account is not required when guest card checkout is available. IFund verifies the completed receipt before enabling Premium.
    </p>
    {error&&<p role="alert" className="text-sm text-destructive">{error}</p>}
    {(purchaseState==="pending"||checkoutPhase==="review"||checkoutPhase==="card-error"||checkoutPhase==="invalid")&&<div className="space-y-2 rounded-xl border border-border p-3">
      <p className="text-xs text-muted-foreground">{purchaseState==="pending"?"A purchase attempt may already exist. Complete receipt review before any further payment.":"Card inputs are securely hosted by PayPal. A field error does not prove a charge occurred."}</p>
      <button type="button" disabled={statusChecking||busy} onClick={checkPurchaseStatus}
        className="min-h-11 rounded-lg border border-cyan-500/40 px-4 text-sm font-semibold disabled:opacity-50">
        {statusChecking?"Checking recorded purchase…":"Check my Premium purchase status"}
      </button>
    </div>}
  </div>;
}
