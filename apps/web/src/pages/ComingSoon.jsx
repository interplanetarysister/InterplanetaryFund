import React from "react";
import { Link, useLocation } from "react-router-dom";
import { Compass, House, Sparkles } from "lucide-react";
import BrandLogo from "@/components/brand/BrandLogo";

// Branded placeholder for areas that are not yet ported to the new platform
// (sign-in, campaign creation, dashboard, community, help, and so on).
export default function ComingSoon() {
  const { pathname } = useLocation();
  return (
    <main className="ifund-public ifund-auth min-h-dvh flex items-center justify-center px-5 py-12 text-white">
      <div className="w-full max-w-xl">
        <Link to="/" className="inline-flex items-center rounded-xl py-2" aria-label="Return to Interplanetary Fund">
          <BrandLogo size="sm" nameClassName="text-slate-100" />
        </Link>
        <section className="ifund-auth-card mt-7 rounded-3xl p-7 sm:p-10">
          <p className="ifund-editorial-eyebrow mb-4">New platform</p>
          <Sparkles className="h-10 w-10 text-cyan-200" aria-hidden="true" />
          <h1 className="mt-4 text-3xl font-semibold tracking-tight text-white">Coming soon on the new platform</h1>
          <p className="mt-3 text-sm leading-6 text-slate-300">
            Interplanetary Fund is moving to its new home. This area is being rebuilt and will open here soon. You can still explore campaigns and read about us.
          </p>
          <p className="mt-3 max-w-full break-all font-mono text-xs text-slate-400">
            {pathname.length > 120 ? pathname.slice(0, 120) + "..." : pathname}
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link to="/" className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-cyan-400 px-4 text-sm font-semibold text-slate-950 hover:bg-cyan-300">
              <House className="h-4 w-4" /> Home
            </Link>
            <Link to="/discover" className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-500 px-4 text-sm font-semibold text-slate-100 hover:bg-white/10">
              <Compass className="h-4 w-4" /> Explore campaigns
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
