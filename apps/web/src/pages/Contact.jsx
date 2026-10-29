import React from "react";
import { Link } from "react-router-dom";
import { Mail, MessageSquare } from "lucide-react";
import BrandLogo from "@/components/brand/BrandLogo";
import LegalFooter from "@/components/LegalFooter";

const CONTACT_EMAIL = "hello@interplanetaryfund.com";

// Until an independently verified contact endpoint exists, never pretend a message was sent.
export default function Contact() {
  return <div className="ifund-public min-h-dvh bg-background text-foreground">
    <section className="ifund-public-hero relative overflow-hidden deep-space">
      <div className="relative mx-auto max-w-3xl px-5 py-16 text-center sm:px-8 sm:py-24">
        <div className="mb-8 flex justify-center"><Link to="/" aria-label="Interplanetary Fund home"><BrandLogo size="sm" nameClassName="text-slate-100 text-sm" /></Link></div>
        <h1 className="ifund-home-headline font-display mb-6 text-4xl leading-tight text-white sm:text-6xl">Get in <span className="brand-gradient-text">touch</span></h1>
        <p className="mx-auto max-w-xl text-base leading-relaxed text-slate-300 sm:text-lg">Questions, feedback, or partnership ideas? We'd love to hear from you.</p>
      </div>
    </section>
    <main className="mx-auto max-w-2xl px-5 py-14 sm:px-8 sm:py-20">
      <div className="grid gap-4 sm:grid-cols-2">
        <a href={`mailto:${CONTACT_EMAIL}`} className="flex min-h-20 items-center gap-3 rounded-xl border border-border bg-card p-5 hover:bg-accent">
          <Mail className="h-6 w-6 shrink-0 text-primary" aria-hidden="true" />
          <span className="min-w-0"><strong className="block text-sm">Email us</strong><span className="block break-all text-sm text-muted-foreground">{CONTACT_EMAIL}</span></span>
        </a>
        <Link to="/help" className="flex min-h-20 items-center gap-3 rounded-xl border border-border bg-card p-5 hover:bg-accent">
          <MessageSquare className="h-6 w-6 shrink-0 text-primary" aria-hidden="true" />
          <span><strong className="block text-sm">Help center</strong><span className="block text-sm text-muted-foreground">Browse FAQs &amp; articles</span></span>
        </Link>
      </div>
      <section className="mt-8 rounded-2xl border border-border bg-card p-6">
        <h2 className="font-display text-2xl">Send a message</h2>
        <p className="mt-3 text-sm text-muted-foreground">The online contact form is being migrated. For now, use your email application to send a message. The website will not collect or store your message.</p>
        <a href={`mailto:${CONTACT_EMAIL}`} className="mt-5 inline-flex min-h-11 items-center rounded-xl bg-cyan-600 px-5 py-3 font-semibold text-white hover:bg-cyan-700">Open email application</a>
      </section>
    </main>
    <LegalFooter />
  </div>;
}
