import React from "react";
import { Link, useLocation } from "react-router-dom";
import { Compass, House, LifeBuoy, ArrowUpRight } from "lucide-react";
import BrandLogo from "@/components/brand/BrandLogo";

// A useful recovery page, not a dead-end or a developer/agent instruction.
export default function PageNotFound() {
  const { pathname } = useLocation();
  return (
    <main className="ifund-public ifund-auth min-h-dvh flex items-center justify-center px-5 py-12 text-white">
      <div className="w-full max-w-xl">
        <Link to="/" className="inline-flex items-center rounded-xl py-2" aria-label="Return to Interplanetary Fund">
          <BrandLogo size="sm" nameClassName="text-slate-100" />
        </Link>
        <section className="ifund-auth-card mt-7 rounded-3xl p-7 sm:p-10">
          <p className="ifund-editorial-eyebrow mb-4">Navigation</p>
          <p className="text-6xl font-semibold tracking-tight text-cyan-200" aria-hidden="true">404</p>
          <h1 className="mt-4 text-3xl font-semibold tracking-tight text-white">This page isn't available</h1>
          <p className="mt-3 text-sm leading-6 text-slate-300">
            The link may have changed, or the page may no longer be here. Your account and campaigns are not affected.
          </p>
          <p className="mt-3 max-w-full break-all font-mono text-xs text-slate-400">
            {pathname.length > 120 ? pathname.slice(0,120) + "…" : pathname}
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
        <Link to="/help" className="mt-5 inline-flex items-center gap-2 text-sm text-slate-300 hover:text-white">
          <LifeBuoy className="h-4 w-4" /> Help Center <ArrowUpRight className="h-4 w-4" />
        </Link>
      </div>
    </main>
  );
}
