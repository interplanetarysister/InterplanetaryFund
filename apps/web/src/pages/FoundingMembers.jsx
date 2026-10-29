import React from "react";
import { Link } from "react-router-dom";
import BrandLogo from "@/components/brand/BrandLogo";
import LegalFooter from "@/components/LegalFooter";

// Original waitlist wrote through joinFoundingWaitlist. Do not collect email
// addresses until an independently hosted, consent-audited endpoint is ready.
export default function FoundingMembers() {
  return <div className="ifund-public min-h-dvh bg-background text-foreground">
    <main className="mx-auto max-w-xl px-5 py-10 sm:py-20">
      <div className="mb-8 flex justify-center"><Link to="/" aria-label="Interplanetary Fund home"><BrandLogo size="sm" /></Link></div>
      <section className="rounded-3xl border border-cyan-500/30 bg-card p-5 shadow-xl sm:p-9">
        <p className="mb-3 text-center text-xs font-semibold uppercase tracking-widest text-cyan-600">Founding Members · Early access</p>
        <h1 className="text-center font-display text-3xl font-bold sm:text-4xl">What if you were here from the beginning?</h1>
        <p className="my-5 text-center text-muted-foreground">Be part of the first Interplanetary Fund community. Founding membership is free. Support causes and ideas, create fundraisers, and help shape the platform.</p>
        <div className="rounded-2xl border border-cyan-500/30 bg-cyan-500/5 p-5">
          <h2 className="font-semibold">Early-access registration is being transferred</h2>
          <p className="mt-2 text-sm text-muted-foreground">The independent waitlist is not yet accepting registrations. No signup data is collected on this page. Please check back when registration is available.</p>
          <Link to="/contact" className="mt-4 inline-flex min-h-11 items-center rounded-xl bg-cyan-600 px-5 py-3 font-semibold text-white hover:bg-cyan-700">Contact the team</Link>
        </div>
        <p className="mt-5 text-sm text-muted-foreground">Read the <Link className="underline" to="/privacy">Privacy Policy</Link> and <Link className="underline" to="/terms">Terms of Service</Link>.</p>
      </section>
    </main>
    <LegalFooter />
  </div>;
}
