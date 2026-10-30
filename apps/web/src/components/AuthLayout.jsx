import React from "react";
import BrandLogo from "@/components/brand/BrandLogo";
import { SLOGAN } from "@/components/brand/brand";

export default function AuthLayout({ icon: Icon, title, subtitle, footer, children }) {
  return (
    <div className="ifund-auth min-h-screen deep-space flex items-center justify-center px-4 py-10 pt-safe pb-safe">
      <div className="w-full max-w-md animate-fade-up">
        <div className="text-center mb-8">
          <BrandLogo size="md" className="justify-center mb-5" nameClassName="text-slate-100 text-lg" />
          <p className="text-[10px] uppercase font-semibold tracking-[.23em] text-cyan-200 mb-2">Interplanetary Fund · Member Access</p>
          <p className="font-display text-xl brand-gradient-text mb-6">{SLOGAN}</p>
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl glass-panel mb-4">
            <Icon className="w-6 h-6 text-cyan-300" aria-hidden="true" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-display tracking-tight text-white">{title}</h1>
          {subtitle && <p className="text-slate-400 mt-2 text-sm">{subtitle}</p>}
        </div>
        <div className="ifund-auth-card rounded-3xl p-6 sm:p-8 shadow-2xl">
          {children}
        </div>
        {footer && (
          <p className="text-center text-sm text-slate-400 mt-6">{footer}</p>
        )}
      </div>
    </div>
  );
}