import React, { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Mail, MessageSquare, CheckCircle2, ArrowRight } from "lucide-react";
import BrandLogo from "@/components/brand/BrandLogo";
import LegalFooter from "@/components/LegalFooter";

const CONTACT_EMAIL = "hello@interplanetaryfund.com";

export default function Contact() {
  const [form, setForm] = useState({ name: "", email: "", message: "" });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name || !form.email || !form.message) {
      setError("Please fill in all fields.");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const { base44 } = await import("@/api/base44Client");
      const { data } = await base44.functions.invoke("sendPublicContactMessage", form);
      if (data?.ok !== true) throw new Error("Contact send not confirmed");
      setSubmitted(true);
    } catch (err) {
      setError("We couldn't send your message right now. Please email us directly using the address below.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="ifund-public min-h-dvh bg-background">
      {/* Hero */}
      <section className="ifund-public-hero relative overflow-hidden deep-space">
        <div className="relative px-5 sm:px-8 py-16 sm:py-24 max-w-3xl mx-auto text-center">
          <div className="flex justify-center mb-8"><BrandLogo size="sm" nameClassName="text-slate-100 text-sm" /></div>
          <h1 className="ifund-home-headline font-display text-4xl sm:text-6xl leading-[1.05] text-white mb-6">
            Get in <span className="brand-gradient-text">touch</span>
          </h1>
          <p className="text-slate-300 text-base sm:text-lg leading-relaxed max-w-xl mx-auto">
            Questions, feedback, or partnership ideas? We'd love to hear from you.
          </p>
        </div>
      </section>

      {/* Contact methods + form */}
      <section className="max-w-2xl mx-auto px-5 sm:px-8 py-14 sm:py-20">
        <div className="grid sm:grid-cols-2 gap-4 mb-10">
          <a href={`mailto:${CONTACT_EMAIL}`} className="flex items-center gap-3 rounded-xl border border-border bg-card p-5 hover:bg-accent transition-colors">
            <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <Mail className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground">Email us</p>
              <p className="text-sm text-muted-foreground truncate">{CONTACT_EMAIL}</p>
            </div>
          </a>
          <Link to="/help" className="flex items-center gap-3 rounded-xl border border-border bg-card p-5 hover:bg-accent transition-colors">
            <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <MessageSquare className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">Help center</p>
              <p className="text-sm text-muted-foreground">Browse FAQs & articles</p>
            </div>
          </Link>
        </div>

        {submitted ? (
          <div className="rounded-2xl border border-border bg-card p-8 text-center">
            <div className="w-14 h-14 rounded-2xl bg-green-100 text-green-600 flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="w-7 h-7" />
            </div>
            <h2 className="font-display text-2xl text-foreground mb-2">Message sent</h2>
            <p className="text-muted-foreground mb-6">Thank you for reaching out. We'll get back to you as soon as possible.</p>
            <Link to="/"><Button variant="outline" className="rounded-xl">Back home <ArrowRight className="w-4 h-4 ml-2" /></Button></Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="rounded-2xl border border-border bg-card p-6 sm:p-8 space-y-5">
            <h2 className="font-display text-2xl text-foreground">Send a message</h2>
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input id="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Your name" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="you@example.com" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="message">Message</Label>
              <Textarea id="message" value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} placeholder="How can we help?" rows={5} />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit" disabled={submitting} className="w-full rounded-xl bg-gradient-to-r from-cyan-400 to-blue-600 text-white border-0 hover:opacity-90">
              {submitting ? "Sending…" : "Send message"}
            </Button>
          </form>
        )}
      </section>
      <LegalFooter />
    </div>
  );
}