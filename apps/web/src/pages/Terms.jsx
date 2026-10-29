import React from "react";
import { Link } from "react-router-dom";
import LegalFooter from "@/components/LegalFooter";
import { TERMS_SECTIONS, TERMS_VERSION, LEGAL_EFFECTIVE_DATE, LEGAL_CONTACT } from "@/lib/legalPolicy";

export default function Terms() {
  return <main className="min-h-screen bg-background text-foreground px-4 py-8 sm:py-12">
    <article className="mx-auto max-w-3xl space-y-6">
      <Link to="/" className="text-sm font-semibold text-primary underline">Interplanetary Fund home</Link>
      <h1 className="text-3xl font-bold">Terms of Service</h1>
      <p className="text-sm text-muted-foreground">Version {TERMS_VERSION} · Effective {LEGAL_EFFECTIVE_DATE}</p>
      <p className="rounded-xl border border-border bg-card p-4 text-sm">Please read these conditions before accepting. In particular, review the payment risks, AI limitations, intellectual property rules, and Section 7’s limitation of liability. These provisions cannot override rights guaranteed by law.</p>
      {TERMS_SECTIONS.map((section) => <section key={section.title} className="space-y-3">
        <h2 className="text-lg font-semibold">{section.title}</h2>
        {section.paragraphs.map((p,i) => <p key={i} className="whitespace-pre-wrap text-sm leading-7 text-foreground">{p}</p>)}
      </section>)}
      <div className="border-t border-border pt-4 text-sm">Privacy details: <Link to="/privacy" className="text-primary underline">Privacy Policy</Link> · Questions: <a href={`mailto:${LEGAL_CONTACT}`} className="underline">{LEGAL_CONTACT}</a></div>
    </article>
    <LegalFooter />
  </main>;
}
