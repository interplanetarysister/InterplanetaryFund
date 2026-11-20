import React from "react";
import { CheckCircle2, Image as ImageIcon, Megaphone, ReceiptText, Share2, Target, Users } from "lucide-react";
import { templateCategory, templateStyle } from "@/lib/campaignTemplates";
import { CategoryGlyph } from "./CampaignCategoryGrid";

/**
 * A real, responsive preview of a campaign layout. It renders the owner's
 * current content when supplied; otherwise it shows clearly-labelled example
 * text. It never shows fabricated donations, supporters or progress: those
 * areas say what will appear once verified activity exists.
 */
export default function CampaignTemplatePreview({
  template = "clean",
  category = "other",
  content = {},
  viewport = "desktop",
  example = false,
}) {
  const style = templateStyle(template);
  const cat = templateCategory(category);
  const dark = style.id === "cosmic";
  const title = String(content.title || "").trim() || "Your campaign title";
  const summary = String(content.summary || "").trim() ||
    "One or two clear sentences about what you are raising for and why it matters.";
  const story = String(content.story || "").trim() ||
    "Your story appears here, written in your own words. Add only details you are comfortable sharing publicly.";
  const goal = String(content.goal_amount || content.goal || "").trim();
  const numericGoal = Number(goal);

  return (
    <article
      className={`overflow-hidden rounded-3xl border ${style.ring} bg-gradient-to-br ${style.surface} shadow-xl ${dark ? "text-slate-100" : "text-stone-900"} ${viewport === "mobile" ? "mx-auto w-full max-w-[390px]" : "w-full"}`}
      aria-label={`${style.name} campaign preview`}
    >
      <div className={`relative border-b ${dark ? "border-white/10" : "border-black/5"} p-5 sm:p-7`}>
        <div className="flex flex-wrap items-center gap-2">
          <span className={`inline-flex min-h-7 items-center gap-1.5 rounded-full px-3 text-xs font-semibold ${dark ? "bg-white/10 text-cyan-200" : "bg-white/80 text-stone-700"} border ${style.ring}`}>
            <CategoryGlyph icon={cat.icon} className="h-3.5 w-3.5" />
            {cat.label}
          </span>
          <span className={`inline-flex min-h-7 items-center rounded-full px-3 text-xs font-medium ${dark ? "bg-white/5 text-slate-300" : "bg-white/70 text-stone-600"}`}>
            {style.name}
          </span>
          {example && (
            <span className={`inline-flex min-h-7 items-center rounded-full px-3 text-xs font-medium ${dark ? "bg-amber-300/15 text-amber-200" : "bg-amber-100 text-amber-900"}`}>
              Example layout
            </span>
          )}
        </div>
        <h3 className={`mt-4 font-display text-2xl leading-tight sm:text-3xl ${dark ? "text-white" : "text-stone-950"}`}>{title}</h3>
        <p className={`mt-2 max-w-2xl text-sm leading-relaxed sm:text-base ${dark ? "text-slate-300" : "text-stone-600"}`}>{summary}</p>
      </div>

      <div className="space-y-4 p-5 sm:p-7">
        <div className={`grid gap-3 ${viewport === "mobile" ? "" : "sm:grid-cols-[1.1fr_0.9fr]"}`}>
          <section className={`rounded-2xl border p-4 ${dark ? "border-white/10 bg-white/5" : "border-black/5 bg-white/80"}`} aria-label="Funding goal">
            <p className={`flex items-center gap-2 text-xs font-semibold uppercase tracking-wide ${style.accent}`}>
              <Target className="h-4 w-4" aria-hidden="true" /> Funding goal
            </p>
            <p className="mt-2 font-display text-2xl">{goal && Number.isFinite(numericGoal) && numericGoal > 0 ? `$${numericGoal.toLocaleString()}` : "Set your goal"}</p>
            <p className={`mt-1 text-xs ${dark ? "text-slate-400" : "text-stone-500"}`}>
              A goal is the amount you are working toward, not a guarantee of funds.
            </p>
          </section>
          <section className={`rounded-2xl border p-4 ${dark ? "border-white/10 bg-white/5" : "border-black/5 bg-white/80"}`} aria-label="Progress">
            <p className={`flex items-center gap-2 text-xs font-semibold uppercase tracking-wide ${style.accent}`}>
              <CheckCircle2 className="h-4 w-4" aria-hidden="true" /> Progress
            </p>
            <div className={`mt-3 h-2 overflow-hidden rounded-full ${dark ? "bg-white/10" : "bg-stone-200"}`}>
              <div className={`h-full w-0 rounded-full ${style.accentBg}`} />
            </div>
            <p className={`mt-2 text-xs ${dark ? "text-slate-400" : "text-stone-500"}`}>
              Verified donations appear here after the payment provider confirms them. Nothing is invented.
            </p>
          </section>
        </div>

        <section className={`rounded-2xl border p-4 ${dark ? "border-white/10 bg-white/5" : "border-black/5 bg-white/80"}`} aria-label="Campaign story">
          <p className={`text-xs font-semibold uppercase tracking-wide ${style.accent}`}>Your story</p>
          <p className={`mt-2 whitespace-pre-wrap text-sm leading-relaxed ${dark ? "text-slate-300" : "text-stone-700"}`}>{story.slice(0, 900)}</p>
        </section>

        <div className={`grid grid-cols-2 gap-3 ${viewport === "mobile" ? "" : "sm:grid-cols-4"}`}>
          {[
            { icon: ImageIcon, label: "Gallery" },
            { icon: Megaphone, label: "Updates" },
            { icon: ReceiptText, label: "Spending" },
            { icon: Users, label: "Supporters" },
          ].map(({ icon: Icon, label }) => (
            <div key={label} className={`rounded-2xl border p-3 ${dark ? "border-white/10 bg-white/5" : "border-black/5 bg-white/80"}`}>
              <Icon className={`h-4 w-4 ${style.accent}`} aria-hidden="true" />
              <p className="mt-2 text-sm font-medium">{label}</p>
              <p className={`mt-1 text-xs ${dark ? "text-slate-400" : "text-stone-500"}`}>Ready for your content</p>
            </div>
          ))}
        </div>

        <div className={`flex flex-wrap items-center gap-3 rounded-2xl border p-4 ${dark ? "border-white/10 bg-white/5" : "border-black/5 bg-white/80"}`}>
          <span className={`inline-flex min-h-12 flex-1 items-center justify-center rounded-xl px-5 font-semibold ${style.accentBg} ${dark ? "text-slate-950" : "text-white"}`}>
            Donate
          </span>
          <span className={`inline-flex min-h-12 items-center gap-2 rounded-xl border px-4 text-sm font-semibold ${dark ? "border-white/20 text-slate-200" : "border-stone-300 text-stone-800"}`}>
            <Share2 className="h-4 w-4" aria-hidden="true" /> Share
          </span>
        </div>
      </div>
    </article>
  );
}
