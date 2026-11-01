import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { authClient } from "@/api/auth";
import { callbackParameters, completeAuthCallback, strippedAuthCallbackLocation } from "@/lib/authCallback";

export default function AuthCallback(){
  const navigate=useNavigate();
  const attempt=useRef(null);
  const [status,setStatus]=useState({phase:"working",message:"Verifying your account…"});
  useEffect(()=>{
    let mounted=true;
    if(!attempt.current){
      // Capture once; strip credentials and error details from browser history
      // immediately. StrictMode must not exchange single-use codes twice.
      const params=callbackParameters(window.location.href);
      window.history.replaceState(window.history.state,"",
        strippedAuthCallbackLocation(window.location.origin));
      attempt.current=Promise.resolve().then(()=>completeAuthCallback(authClient().auth,params));
    }
    attempt.current.then(destination=>{
      if(mounted)navigate(destination,{replace:true});
    }).catch(error=>{
      if(mounted)setStatus({phase:"failed",message:error?.message||
        "Verification could not be completed. Please request a new confirmation link."});
    });
    return()=>{mounted=false;};
  },[navigate]);
  return <main className="ifund-public ifund-auth min-h-dvh px-5 py-12 text-white">
    <section className="ifund-auth-card mx-auto max-w-md space-y-5 rounded-3xl p-7 sm:p-10">
      <h1 className="text-3xl font-semibold">Account verification</h1>
      {status.phase==="working"?
        <p role="status" aria-live="polite">Confirming your email and securely completing sign-in…</p>:
        <p role="alert" className="text-red-200">{status.message}</p>}
      {status.phase==="failed"&&<div className="flex flex-wrap gap-4 text-sm">
        <Link to="/login" className="underline text-cyan-200">Sign in</Link>
        <Link to="/register" className="underline text-cyan-200">Request a new confirmation</Link>
        <Link to="/forgot-password" className="underline text-cyan-200">Reset password</Link>
      </div>}
    </section>
  </main>;
}
