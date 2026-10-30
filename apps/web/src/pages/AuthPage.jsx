import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import AuthLayout from "@/components/AuthLayout";
import { UserPlus, LogIn, Mail } from "lucide-react";
import { authClient } from "@/api/auth";
import { safeReturnTo } from "@/lib/safeReturnTo";
import { authCallbackUrl } from "@/lib/authCallback";
import { landingAfterLogin } from "@/lib/postLogin";
import { isVerifiedEmailUser } from "@/lib/verifiedEmailUser";

export default function AuthPage({ mode="login" }){
  const navigate=useNavigate();
  const [searchParams]=useSearchParams();
  const afterLogin=safeReturnTo(searchParams.get("returnTo"));
  const [email,setEmail]=useState("");
  const [username,setUsername]=useState("");
  const [otpCode,setOtpCode]=useState("");
  const [password,setPassword]=useState("");
  const [confirmPassword,setConfirmPassword]=useState("");
  const [busy,setBusy]=useState(false);
  const [resending,setResending]=useState(false);
  const [needsConfirmation,setNeedsConfirmation]=useState(false);
  const [message,setMessage]=useState("");
  const [error,setError]=useState("");
  const isRegister=mode==="register";
  const isReset=mode==="forgot-password";

  async function submit(event){
    event.preventDefault();
    if(busy||resending)return;
    setBusy(true);setError("");setMessage("");
    const normalizedEmail=email.trim();
    try{
      if(!normalizedEmail)throw new Error("Enter your email address.");
      if(isRegister && !/^[A-Za-z0-9_-]{3,32}$/.test(username.trim()))
        throw new Error("Choose a username of 3–32 letters, numbers, underscores or hyphens.");
      if(isRegister && password!==confirmPassword)
        throw new Error("Your passwords do not match.");
      const auth=authClient().auth;
      if(isReset){
        const {error:failure}=await auth.resetPasswordForEmail(normalizedEmail,{
          redirectTo:authCallbackUrl(window.location.origin,{recovery:true})
        });
        if(failure)throw failure;
        setMessage("If this address has an account, a password reset email will arrive. Use the most recent link.");
      }else if(isRegister){
        const {data,error:failure}=await auth.signUp({
          email:normalizedEmail,password,
          options:{emailRedirectTo:authCallbackUrl(window.location.origin),
            // A display hint only; never trust user_metadata for privileges.
            data:{preferred_handle:username.trim()}}
        });
        if(failure)throw failure;
        if(data?.session){
          const {data:verified,error:verifyError}=await auth.getUser();
          if(verifyError || !verified?.user?.id)throw new Error("Your account session could not be verified. Try signing in again.");
          if(!isVerifiedEmailUser(verified.user)){
            setNeedsConfirmation(true);
            const {error:signoutError}=await auth.signOut();
            if(signoutError)throw new Error("Your email is not confirmed and the temporary session could not be cleared. Protected account features remain blocked; request a new confirmation email.");
            throw new Error("Your email confirmation is not complete. Check the newest verification email.");
          }
          navigate("/onboarding",{replace:true});
        }else{
          setNeedsConfirmation(true);
          setMessage("Check your inbox and spam folder for the newest confirmation email. Open the link to finish signing up before signing in.");
        }
      }else{
        const {data,error:failure}=await auth.signInWithPassword({
          email:normalizedEmail,password
        });
        if(failure){
          if(failure.code==="email_not_confirmed"){
            setNeedsConfirmation(true);
            throw new Error("Your email has not been confirmed. Open the newest confirmation email or request another one below.");
          }
          if(failure.code==="invalid_credentials")
            throw new Error("Email or password not accepted. Check your credentials or use password recovery.");
          throw failure;
        }
        if(!data?.session)throw new Error("Sign-in did not create a session.");
        const {data:verified,error:verifyError}=await auth.getUser();
        if(verifyError || !verified?.user?.id)throw new Error("The sign-in session could not be verified.");
        if(!isVerifiedEmailUser(verified.user)){
          setNeedsConfirmation(true);
          const {error:signoutError}=await auth.signOut();
          if(signoutError)throw new Error("Your email is not confirmed. Protected account features remain blocked; request a new confirmation email.");
          throw new Error("Your email has not been confirmed. Open the newest confirmation email or request another one below.");
        }
        const destination=await landingAfterLogin(authClient(),afterLogin);
        navigate(destination,{replace:true});
      }
    }catch(cause){
      setError(cause?.message||"Authentication could not be completed.");
    }finally{setBusy(false);}
  }

  async function verifyCode(){
    if(busy||resending)return;
    if(!/^\d{6,8}$/.test(otpCode.trim())){
      setError("Enter the complete verification code from your newest email.");
      return;
    }
    setBusy(true);setError("");setMessage("");
    try{
      const auth=authClient().auth;
      const {error:failure}=await auth.verifyOtp({
        email:email.trim(),token:otpCode.trim(),type:"signup"
      });
      if(failure)throw failure;
      const {data:verified,error:verifyError}=await auth.getUser();
      if(verifyError||!verified?.user?.id||!verified.user.email_confirmed_at)
        throw new Error("Confirmation was not verified. Please request a new email.");
      navigate("/onboarding",{replace:true});
    }catch(cause){
      setError(cause?.message||"The code could not be verified. Open the newest email or request another code.");
    }finally{setBusy(false);}
  }

  async function resend(){
    if(busy||resending||!email.trim())return;
    setResending(true);setError("");setMessage("");
    try{
      const {error:failure}=await authClient().auth.resend({
        type:"signup",email:email.trim(),
        options:{emailRedirectTo:authCallbackUrl(window.location.origin)}
      });
      if(failure)throw failure;
      setNeedsConfirmation(true);
      setMessage("If this account is waiting for confirmation, a new email was requested. Use its newest link; delivery can be delayed or limited by the email provider.");
    }catch(cause){
      setError(cause?.message||"A new confirmation email could not be requested.");
    }finally{setResending(false);}
  }

  const heading=isReset?"Reset your password":isRegister?"Create your account":"Welcome back";
  const subtitle=isReset?"Get a secure password reset email.":isRegister?
    "Sign up to get started":"Log in to your account";
  return <AuthLayout icon={isReset?Mail:isRegister?UserPlus:LogIn} title={heading} subtitle={subtitle}>
    <div className="text-white">
        {isRegister&&<p className="mt-4 text-xs text-slate-300">
          After verification, review and accept our <Link to="/terms" className="underline text-cyan-200">Terms of Service</Link> and{" "}
          <Link to="/privacy" className="underline text-cyan-200">Privacy Policy</Link> before using IFund account features.
        </p>}
        <form onSubmit={submit} className="mt-6 space-y-4">
          <label className="block text-sm font-medium">Email address
            <input required type="email" autoComplete="email" maxLength={254}
              value={email} onChange={event=>{setEmail(event.target.value);setNeedsConfirmation(false);}}
              className="mt-2 min-h-12 w-full rounded-xl border border-slate-500 bg-white px-4 text-slate-950"/>
          </label>
          {isRegister&&<label className="block text-sm font-medium">Username
            <input required type="text" autoComplete="username" maxLength={32}
              value={username} onChange={event=>setUsername(event.target.value)}
              placeholder="yourhandle"
              className="mt-2 min-h-12 w-full rounded-xl border border-slate-500 bg-white px-4 text-slate-950"/>
          </label>}
          {!isReset&&<label className="block text-sm font-medium">Password
            <input required minLength={8} type="password"
              autoComplete={isRegister?"new-password":"current-password"}
              value={password} onChange={event=>setPassword(event.target.value)}
              className="mt-2 min-h-12 w-full rounded-xl border border-slate-500 bg-white px-4 text-slate-950"/>
          </label>}
          {isRegister&&<label className="block text-sm font-medium">Confirm password
            <input required minLength={8} type="password" autoComplete="new-password"
              value={confirmPassword} onChange={event=>setConfirmPassword(event.target.value)}
              className="mt-2 min-h-12 w-full rounded-xl border border-slate-500 bg-white px-4 text-slate-950"/>
          </label>}
          {error&&<p role="alert" className="text-sm text-red-200">{error}</p>}
          {message&&<p role="status" className="text-sm text-cyan-200">{message}</p>}
          <button disabled={busy||resending} type="submit"
            className="min-h-12 w-full rounded-xl bg-cyan-400 px-4 font-semibold text-slate-950 disabled:opacity-60">
            {busy?"Please wait…":isReset?"Email reset link":isRegister?"Create account":"Sign in"}
          </button>
        </form>
        {needsConfirmation&&!isReset&&<section aria-label="Verify your email address" className="mt-5 rounded-xl border border-slate-500 p-4">
          <h2 className="text-lg font-semibold">Verify your email</h2>
          <p className="mt-2 text-sm text-slate-300">Open the confirmation link in the newest email, or enter its verification code here if one is provided.</p>
          <label className="mt-3 block text-sm font-medium">Email verification code
            <input type="text" inputMode="numeric" autoComplete="one-time-code" maxLength={8}
              pattern="[0-9]{6,8}" value={otpCode}
              onChange={event=>setOtpCode(event.target.value.replace(/[^0-9]/g,"").slice(0,8))}
              className="mt-2 min-h-12 w-full rounded-xl border border-slate-500 bg-white px-4 text-center font-mono text-xl tracking-widest text-slate-950"/>
          </label>
          <button type="button" disabled={busy||resending||otpCode.length<6}
            onClick={verifyCode} className="mt-3 min-h-11 w-full rounded-xl bg-cyan-400 px-4 font-semibold text-slate-950 disabled:opacity-60">
            {busy?"Verifying…":"Verify"}
          </button>
        </section>}
        {(needsConfirmation||isRegister)&&!isReset&&<button type="button" disabled={busy||resending||!email.trim()}
          onClick={resend} className="mt-4 min-h-11 text-sm font-semibold text-cyan-200 underline disabled:opacity-60">
          {resending?"Requesting confirmation…":"Resend confirmation email"}
        </button>}
        <nav className="mt-5 flex flex-wrap gap-4 text-sm text-cyan-200">
          {!isRegister&&<Link to="/register" className="underline">Create an account</Link>}
          {mode!=="login"&&<Link to="/login" className="underline">Sign in</Link>}
          {!isReset&&<Link to="/forgot-password" className="underline">Forgot password?</Link>}
        </nav>
    </div>
  </AuthLayout>;
}
