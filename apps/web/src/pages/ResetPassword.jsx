import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { authClient } from "@/api/auth";
import AuthLayout from "@/components/AuthLayout";
import { Lock } from "lucide-react";

export default function ResetPassword(){
  const [password,setPassword]=useState("");
  const [confirm,setConfirm]=useState("");
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  const [message,setMessage]=useState("");
  const navigate=useNavigate();

  async function submit(event){
    event.preventDefault();
    if(busy)return;
    setBusy(true);setError("");setMessage("");
    try{
      if(password!==confirm)throw new Error("Your passwords do not match.");
      const client=authClient();
      const {data:{session},error:sessionError}=await client.auth.getSession();
      if(sessionError||!session)throw new Error("Open the newest password reset link from your email before changing your password.");
      const {data:verified,error:verifyError}=await client.auth.getUser();
      if(verifyError||!verified?.user?.id)
        throw new Error("Your recovery session could not be verified. Request a new password reset email.");
      const {error:updateError}=await client.auth.updateUser({password});
      if(updateError)throw updateError;
      const {error:signoutError}=await client.auth.signOut();
      if(signoutError){
        setMessage("Password updated, but automatic sign-out was not confirmed. Sign out manually on your account before leaving this device.");
        return;
      }
      navigate("/login",{replace:true});
    }catch(cause){
      setError(cause?.message||"Password could not be changed.");
    }finally{setBusy(false);}
  }

  return <AuthLayout icon={Lock} title="New password" subtitle="Enter your new password below">
    <div className="text-white">
      <p className="text-sm text-slate-300">Use the newest secure link from your email to authorize this change. After updating your password, sign in again.</p>
      <form onSubmit={submit} className="mt-6 space-y-4">
        <label className="block text-sm">New password
          <input type="password" autoComplete="new-password" minLength={8} required
            value={password} onChange={event=>setPassword(event.target.value)}
            className="mt-2 min-h-12 w-full rounded-xl bg-white px-4 text-slate-950"/>
        </label>
        <label className="block text-sm">Confirm new password
          <input type="password" autoComplete="new-password" minLength={8} required
            value={confirm} onChange={event=>setConfirm(event.target.value)}
            className="mt-2 min-h-12 w-full rounded-xl bg-white px-4 text-slate-950"/>
        </label>
        {error&&<p role="alert" className="text-sm text-red-200">{error}</p>}
        {message&&<p role="status" className="text-sm text-cyan-200">{message}</p>}
        <button disabled={busy} type="submit"
          className="min-h-12 w-full rounded-xl bg-cyan-400 px-4 font-semibold text-slate-950 disabled:opacity-60">
          {busy?"Updating…":"Update password"}
        </button>
      </form>
      <div className="mt-5 flex flex-wrap gap-4 text-sm text-cyan-200">
        <Link to="/login" className="underline">Return to sign in</Link>
        <Link to="/forgot-password" className="underline">Request a new recovery link</Link>
      </div>
    </div>
  </AuthLayout>;
}
