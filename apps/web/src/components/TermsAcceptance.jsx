import {useCallback,useEffect,useState} from "react";
import {Link,useLocation} from "react-router-dom";
import BrandLogo from "@/components/brand/BrandLogo";
import useVerifiedUser from "@/lib/useVerifiedUser";
import {authClient} from "@/api/auth";
import {legalAcceptanceStatus,acceptLegalAgreement} from "@/lib/legalAcceptance";
import {TERMS_VERSION} from "@/lib/legalPolicy";

// Exact original consent text; actual acceptance is stored per authenticated
// account and legal version, not inferred from a local checkbox or Auth login.
const PUBLIC_LEGAL_ROUTES=new Set([
 "/","/terms","/privacy","/contact","/help","/login","/register",
 "/forgot-password","/reset-password","/auth/callback"
]);
export default function TermsAcceptance({children}){
 const {pathname}=useLocation();
 const {user,phase}=useVerifiedUser();
 const [status,setStatus]=useState({phase:"checking",owner:null});
 const [agreed,setAgreed]=useState(false);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState("");
 const exempt=PUBLIC_LEGAL_ROUTES.has(pathname)||
   pathname.startsWith("/help/")||pathname.startsWith("/embed/");
 const check=useCallback(async()=>{
  setStatus({phase:"checking",owner:user?.id||null});setError("");
  try{
   const result=await legalAcceptanceStatus(authClient());
   if(result.terms_version!==TERMS_VERSION)throw Error("Legal version mismatch");
   setStatus({phase:result.accepted?"accepted":"pending",owner:user?.id||null});
  }catch{
   setStatus({phase:"error",owner:user?.id||null});
   setError("We could not verify your agreement. Please retry.");
  }
 },[]);
 useEffect(()=>{
  let mounted=true;
  if(!user){setStatus({phase:"checking",owner:null});setAgreed(false);return()=>{mounted=false};}
  if(exempt)return()=>{mounted=false};
  setStatus({phase:"checking",owner:user.id});
  setAgreed(false);
  setError("");
  legalAcceptanceStatus(authClient())
    .then(result=>{if(mounted)setStatus({phase:result.accepted?"accepted":"pending",owner:user.id})})
    .catch(()=>{if(mounted){setError("We could not verify your agreement. Please retry.");setStatus({phase:"error",owner:user.id});}});
  return()=>{mounted=false};
 },[user?.id,exempt]);

 async function accept(){
  if(!agreed||busy)return;
  setBusy(true);setError("");
  try{
   const result=await acceptLegalAgreement(authClient(),{explicit_consent:true});
   if(result.accepted!==true||result.terms_version!==TERMS_VERSION)throw Error("Agreement not verified");
   setStatus({phase:"accepted",owner:user?.id||null});
  }catch{
   setError("Agreement could not be saved. Please try again.");
  }finally{setBusy(false);}
 }
 if(exempt || phase==="ready"&&!user)return children;
 if(phase==="error")return <div role="alert" className="p-8">Account verification is unavailable. No protected content was loaded.</div>;
 if(phase==="loading")return <div role="status" className="p-8">Checking your account…</div>;
 if(status.phase==="accepted"&&status.owner===user?.id)return children;
 const currentStatus=status.owner===user?.id?status.phase:"checking";
 return <div className="fixed inset-0 z-[60] deep-space flex items-center justify-center p-4 overflow-y-auto">
  <section role="dialog" aria-modal="true" aria-labelledby="ifund-terms-title"
    className="glass-panel w-full max-w-lg max-w-full overflow-x-hidden rounded-3xl p-5 sm:p-8 shadow-2xl my-auto space-y-5 text-white">
   <BrandLogo size="sm" className="justify-center"/>
   <h1 id="ifund-terms-title" className="font-display text-2xl text-center text-white">IFund user agreement</h1>
   {currentStatus==="checking"?<p role="status" className="text-sm text-slate-200">Checking your agreement…</p>:
    currentStatus==="error"?<button type="button" onClick={check}
      className="min-h-11 rounded-lg bg-blue-600 px-4 text-white">Retry agreement check</button>:
    <>
     <p className="text-sm leading-relaxed text-slate-200">
      Please review the Terms of Service and Privacy Policy before using your account.
      IFund helps create, manage, and promote fundraisers, including on authorized
      outside platforms when those platforms permit it. IFund's planned campaign
      checkout receives money into an IFund-controlled payment-provider account
      before beneficiary payout, if and when enabled. Review the Terms for campaign,
      AI, payment, and liability rules. Your agreement is saved to your account.
     </p>
     <div className="flex flex-wrap gap-4 text-sm">
      <Link to="/terms" className="font-semibold text-cyan-200 underline">Read full Terms of Service</Link>
      <Link to="/privacy" className="font-semibold text-cyan-200 underline">Read Privacy Policy</Link>
     </div>
     <label className="flex items-start gap-3 rounded-xl border border-white/25 bg-white/10 p-4">
      <input type="checkbox" checked={agreed} onChange={event=>setAgreed(event.target.checked)}
        className="mt-1 h-5 w-5 shrink-0 accent-cyan-400"/>
      <span className="text-sm leading-relaxed text-white">
       I have had the opportunity to read the Terms of Service and Privacy Policy.
       I agree to the Terms, including IFund's role in managing and promoting
       campaigns, future handling and payout of donations, payment and AI risks,
       and the stated limits on liability. I understand external-account actions
       and financial transactions need separate approval and provider permission.
      </span>
     </label>
     <button type="button" onClick={accept} disabled={!agreed||busy}
       className="w-full min-h-12 h-auto py-3 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 px-4 font-semibold text-white">
       {busy?"Saving agreement…":"I Agree — Continue"}
     </button>
    </>}
   {error&&<p role="alert" className="text-sm text-red-200">{error}</p>}
   <p className="text-xs text-slate-300">Agreement version {TERMS_VERSION} · This does not authorize AI spending or external posting.</p>
  </section>
 </div>;
}
