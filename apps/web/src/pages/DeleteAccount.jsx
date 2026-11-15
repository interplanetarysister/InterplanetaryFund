import React from "react";
import { Link } from "react-router-dom";
import MobileStoreDeleteAccount from "@/mobile/MobileStoreDeleteAccount";

// Same direct request + status verification on the website and in signed app.
// Public resource remains accessible without having to reinstall either app.
export default function DeleteAccount(){
  return <main className="min-h-screen bg-[#091821] px-4 py-10 text-slate-100 sm:px-6">
    <div className="mx-auto max-w-3xl space-y-8">
      <header className="space-y-3">
        <Link to="/" className="inline-flex min-h-11 items-center text-emerald-200 underline">
          Interplanetary Fund home
        </Link>
        <p className="text-xs font-bold uppercase tracking-[.2em] text-emerald-200">Account and privacy</p>
      </header>
      <MobileStoreDeleteAccount/>
      <footer className="space-y-2 border-t border-white/15 py-6 text-xs text-slate-300">
        <p>This page is available without the mobile app. Signed-in requests are submitted directly to the official IFund account-deletion queue. No monetary payment is required.</p>
        <p><Link to="/privacy" className="text-emerald-200 underline">Privacy policy</Link> · <Link to="/contact" className="text-emerald-200 underline">Contact IFund</Link></p>
      </footer>
    </div>
  </main>;
}
