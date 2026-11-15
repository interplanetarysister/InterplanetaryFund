import { BrowserRouter, Routes, Route, NavLink, Link, Navigate, useLocation } from "react-router-dom";
import { Compass, Home, Leaf, UserCircle, ShieldCheck, MapPinned } from "lucide-react";
import BrandLogo from "@/components/brand/BrandLogo";
import AuthPage from "@/pages/AuthPage";
import ResetPassword from "@/pages/ResetPassword";
import MemberOnboarding from "@/pages/MemberOnboarding";
import Privacy from "@/pages/Privacy";
import Terms from "@/pages/Terms";
import HealthPrivacy from "@/pages/HealthPrivacy";
import MobileStoreDiscover from "@/mobile/MobileStoreDiscover";
import MobileStoreCampaign from "@/mobile/MobileStoreCampaign";
import MobileStoreAccount from "@/mobile/MobileStoreAccount";
import MobileStoreDeleteAccount from "@/mobile/MobileStoreDeleteAccount";
import MobileReadiness from "@/mobile/MobileReadiness";
import MobileStoreHome from "@/mobile/MobileStoreHome";
import MobileStoreHelp from "@/mobile/MobileStoreHelp";
import MobileMyCampaigns from "@/mobile/MobileMyCampaigns";
import MobileStoreAtlas from "@/mobile/MobileStoreAtlas";

const tabs = [
  ["/", "Home", Home],
  ["/discover", "Explore", Compass],
  ["/plan", "Plan", Leaf],
  ["/account", "Account", UserCircle],
];
const tabStyle = ({ isActive }) => "flex min-h-12 flex-col items-center justify-center gap-1 rounded-xl px-2 py-1 text-[11px] font-semibold transition " +
  (isActive ? "bg-emerald-300/15 text-emerald-200" : "text-slate-300 hover:text-white");

function Frame() {
  const location = useLocation();
  const authentication = /^\/(?:login|register|forgot-password|reset-password|auth\/callback)/.test(location.pathname);
  return <div className="min-h-dvh bg-[#091821] text-slate-100">
    <header className="sticky top-0 z-40 border-b border-emerald-300/20 bg-[#0c202a]/95 px-4 py-3 shadow-lg backdrop-blur" style={{paddingTop:"max(env(safe-area-inset-top), 12px)"}}>
      <div className="mx-auto flex max-w-3xl items-center justify-between gap-3">
        <Link to="/" aria-label="Interplanetary Fund home" className="inline-flex items-center gap-2 rounded-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-200">
          <BrandLogo size="sm"/>
        </Link>
        <Link to="/help" className="min-h-11 rounded-lg border border-emerald-300/30 px-3 py-2 text-sm text-emerald-100">Help</Link>
      </div>
    </header>
    <main id="mobile-main" className="mx-auto w-full max-w-3xl px-4 pb-28 pt-5 sm:px-6">
      <Routes>
        <Route path="/" element={<MobileStoreHome/>}/>
        <Route path="/discover" element={<MobileStoreDiscover/>}/>
        <Route path="/campaign/:id" element={<MobileStoreCampaign/>}/>
        <Route path="/plan" element={<MobileReadiness/>}/>
        <Route path="/atlas" element={<MobileStoreAtlas/>}/>
        <Route path="/account" element={<MobileStoreAccount/>}/>
        <Route path="/dashboard" element={<Navigate to="/account" replace/>}/>
        <Route path="/onboarding" element={<MemberOnboarding/>}/>
        <Route path="/profile" element={<Navigate to="/account" replace/>}/>
        <Route path="/campaigns" element={<MobileMyCampaigns/>}/>
        <Route path="/login" element={<AuthPage mode="login"/>}/>
        <Route path="/register" element={<AuthPage mode="register"/>}/>
        <Route path="/forgot-password" element={<AuthPage mode="forgot-password"/>}/>
        <Route path="/reset-password" element={<ResetPassword/>}/>
        <Route path="/delete-account" element={<MobileStoreDeleteAccount/>}/>
        <Route path="/support" element={<MobileStoreHelp/>}/>
        <Route path="/help" element={<MobileStoreHelp/>}/>
        <Route path="/contact" element={<MobileStoreHelp/>}/>
        <Route path="/terms" element={<Terms/>}/>
        <Route path="/privacy" element={<Privacy/>}/>
        <Route path="/health-privacy" element={<HealthPrivacy/>}/>
        <Route path="*" element={<section className="space-y-4 py-12 text-center" role="status">
          <h1 className="text-2xl font-semibold">This page isn't included in the mobile app</h1>
          <p className="text-sm text-slate-300">Return to the supported, live mobile features.</p>
          <Link className="inline-flex min-h-11 items-center rounded-lg bg-emerald-200 px-4 py-2 font-semibold text-slate-950" to="/discover">Explore campaigns</Link>
        </section>}/>
      </Routes>
    </main>
    {!authentication && <nav aria-label="Mobile app navigation" className="fixed inset-x-0 bottom-0 z-50 border-t border-emerald-300/20 bg-[#0b1d28]/95 px-3 pt-2 backdrop-blur" style={{paddingBottom:"max(env(safe-area-inset-bottom), 8px)"}}>
      <div className="mx-auto grid max-w-3xl grid-cols-4 gap-2">
        {tabs.map(([to,title,Icon])=><NavLink key={to} to={to} end={to==="/"} className={tabStyle}>
          <Icon aria-hidden="true" className="h-5 w-5"/><span>{title}</span>
        </NavLink>)}
      </div>
    </nav>}
    <footer className="mx-auto max-w-3xl space-y-2 border-t border-emerald-300/10 px-5 py-5 text-center text-xs text-slate-400">
      <p>Interplanetary Fund · Explore, organize and share fundraising causes.</p>
      <p className="flex flex-wrap items-center justify-center gap-4">
        <Link to="/terms" className="underline">Terms</Link>
        <Link to="/privacy" className="underline">Privacy</Link>
        <Link to="/delete-account" className="underline">Delete account</Link>
        <Link to="/help" className="underline">Support</Link>
      </p>
      <p>No purchases, monetary gifts, fundraising checkout or paid subscriptions are offered inside this app.</p>
    </footer>
  </div>;
}
export default function MobileStoreApp() {
  return <BrowserRouter><Frame/></BrowserRouter>;
}
