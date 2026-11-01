import React from "react";
import { Link } from "react-router-dom";
import LegalFooter from "@/components/LegalFooter";
import { PRIVACY_SECTIONS, LEGAL_EFFECTIVE_DATE, LEGAL_CONTACT } from "@/lib/legalPolicy";

export default function Privacy() {
  return <main className="min-h-screen bg-background text-foreground px-4 py-8 sm:py-12">
    <article className="mx-auto max-w-3xl space-y-6">
      <Link to="/" className="text-sm font-semibold text-primary underline">Interplanetary Fund home</Link>
      <h1 className="text-3xl font-bold">Privacy Policy</h1>
      <p className="text-sm text-muted-foreground">Last revised {LEGAL_EFFECTIVE_DATE}</p>
      <p className="rounded-xl border border-border bg-card p-4 text-sm">This notice explains categories of information IFund uses. Specific provider and retention details need further verification before broad launch. Privacy rights cannot be waived by checking the Terms box.</p>
      {PRIVACY_SECTIONS.map((section) => <section key={section.title} className="space-y-3">
        <h2 className="text-lg font-semibold">{section.title}</h2>
        {section.paragraphs.map((p,i) => <p key={i} className="text-sm leading-7 text-foreground">{p}</p>)}
      </section>)}
      <div className="border-t border-border pt-4 text-sm">Read: <Link to="/terms" className="text-primary underline">Terms of Service</Link> · Questions: <a href={`mailto:${LEGAL_CONTACT}`} className="underline">{LEGAL_CONTACT}</a></div>
    </article>
    <LegalFooter />
  </main>;
}
