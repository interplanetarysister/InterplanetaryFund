import React, { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ArrowRight, LayoutTemplate, Monitor, Smartphone, Sparkles } from "lucide-react";
import CampaignCategoryGrid from "@/components/campaigns/CampaignCategoryGrid";
import CampaignTemplatePreview from "@/components/campaigns/CampaignTemplatePreview";
import {
  TEMPLATE_SECTIONS, TEMPLATE_STYLES, isTemplateCategory, isTemplateStyle,
  templateCategory, templateOutline, templateStyle,
} from "@/lib/campaignTemplates";

/**
 * Campaign theme gallery. A template gives the owner a clear starting point and
 * a live preview of their own words. It does not publish anything, promise
 * donations, or change the campaign ledger.
 */
export default function CampaignTemplates() {
  const [params, setParams] = useSearchParams();
  const requestedCategory = params.get("category");
  const requestedStyle = params.get("style") || params.get("template");
  const initialCategory = isTemplateCategory(requestedCategory) ? requestedCategory : "community";
  const [category, setCategory] = useState(initialCategory);
  const [style, setStyle] = useState(isTemplateStyle(requestedStyle) ? requestedStyle : templateCategory(initialCategory).style);
  const [viewport, setViewport] = useState("desktop");

  const categoryInfo = templateCategory(category);
  const styleInfo = templateStyle(style);

  function chooseCategory(id) {
    const next = templateCategory(id);
    // Follow the new category's suggestion unless the person deliberately
    // picked a different look for the previous category.
    if (style === templateCategory(category).style) setStyle(next.style);
    setCategory(id);
    setParams((current) => {
      const nextParams = new URLSearchParams(current);
      nextParams.set("category", id);
      return nextParams;
    }, { replace: true });
  }

  function chooseStyle(id) {
    setStyle(id);
    setParams((current) => {
      const nextParams = new URLSearchParams(current);
      nextParams.set("style", id);
      return nextParams;
    }, { replace: true });
  }

  return (
    <main className="ifund-experience mx-auto max-w-7xl space-y-8 px-4 py-8 sm:px-8 sm:py-12">
      <header className="ifund-cosmic-panel relative overflow-hidden rounded-3xl border border-cyan-400/25 p-6 sm:p-9">
        <div className="relative z-10 max-w-2xl">
          <p className="inline-flex items-center gap-2 rounded-full border border-cyan-300/40 bg-cyan-400/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-cyan-700 dark:text-cyan-200">
            <LayoutTemplate className="h-3.5 w-3.5" aria-hidden="true" /> Campaign templates
          </p>
          <h1 className="mt-4 font-display text-3xl leading-tight sm:text-5xl">
            Start with a beautiful layout.
          </h1>
          <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground sm:text-base">
            Pick what your campaign is for, choose a look, and preview it with your own words. You can change everything later. Nothing is published until you decide.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link to={`/create?manual=1&category=${category}&template=${style}`} className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 px-5 font-semibold text-white shadow-lg shadow-blue-500/20">
              Start with this template <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
            <Link to="/discover" className="inline-flex min-h-12 items-center rounded-xl border border-border px-5 font-semibold">
              See real campaigns
            </Link>
          </div>
        </div>
        <Sparkles className="pointer-events-none absolute -right-6 -top-8 h-48 w-48 text-cyan-400/20" aria-hidden="true" />
      </header>

      <section aria-labelledby="template-category-heading" className="space-y-3">
        <div>
          <h2 id="template-category-heading" className="font-display text-2xl">What is your campaign for?</h2>
          <p className="text-sm text-muted-foreground">Choose the closest fit. It helps us suggest a layout and writing prompts.</p>
        </div>
        <CampaignCategoryGrid activeCategory={category} onSelect={chooseCategory} columns="sm:grid-cols-2 lg:grid-cols-3" />
      </section>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(260px,340px)_minmax(0,1fr)]">
        <div className="space-y-4">
          <section aria-labelledby="template-style-heading" className="ifund-cosmic-panel rounded-3xl border border-border p-4">
            <h2 id="template-style-heading" className="font-display text-xl">Choose a look</h2>
            <p className="mt-1 text-sm text-muted-foreground">A starting point, not a lock-in.</p>
            <ul className="mt-3 space-y-2">
              {TEMPLATE_STYLES.map((item) => {
                const active = item.id === style;
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => chooseStyle(item.id)}
                      aria-pressed={active}
                      className={`ifund-tap w-full rounded-2xl border p-3 text-left transition ${active ? "border-cyan-400 bg-cyan-400/10" : "border-border hover:border-cyan-400/50"}`}
                    >
                      <span className="flex items-center justify-between gap-2">
                        <span className="font-semibold">{item.name}</span>
                        {item.id === categoryInfo.style && <span className="rounded-full bg-cyan-500/15 px-2 py-0.5 text-[11px] font-semibold text-cyan-700 dark:text-cyan-200">Suggested</span>}
                      </span>
                      <span className="mt-0.5 block text-xs text-muted-foreground">{item.short}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>

          <section className="ifund-cosmic-panel rounded-3xl border border-border p-4" aria-labelledby="template-sections-heading">
            <h2 id="template-sections-heading" className="font-display text-xl">What the page can show</h2>
            <ul className="mt-3 grid grid-cols-2 gap-1.5 text-sm text-muted-foreground">
              {TEMPLATE_SECTIONS.map((section) => (
                <li key={section.id} className="flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-cyan-500" aria-hidden="true" />
                  {section.label}
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-muted-foreground">
              Financial and supporter areas only appear with real, verified activity. Templates never create donations or testimonials.
            </p>
          </section>

          <details className="rounded-2xl border border-border p-4 text-sm">
            <summary className="cursor-pointer font-semibold">Writing prompts for this category</summary>
            <ul className="mt-3 space-y-2 text-muted-foreground">
              {templateOutline(category).map((item) => (
                <li key={item.heading}><strong className="text-foreground">{item.heading}.</strong> {item.prompt}</li>
              ))}
            </ul>
          </details>
        </div>

        <section aria-labelledby="template-preview-heading" className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 id="template-preview-heading" className="font-display text-2xl">Live preview</h2>
              <p className="text-sm text-muted-foreground">{styleInfo.name} · {categoryInfo.label}</p>
            </div>
            <div className="inline-flex rounded-xl border border-border p-1" role="group" aria-label="Preview size">
              <button type="button" onClick={() => setViewport("desktop")} aria-pressed={viewport === "desktop"} className={`inline-flex min-h-11 items-center gap-2 rounded-lg px-3 text-sm font-medium ${viewport === "desktop" ? "bg-primary text-primary-foreground" : ""}`}>
                <Monitor className="h-4 w-4" aria-hidden="true" /> Desktop
              </button>
              <button type="button" onClick={() => setViewport("mobile")} aria-pressed={viewport === "mobile"} className={`inline-flex min-h-11 items-center gap-2 rounded-lg px-3 text-sm font-medium ${viewport === "mobile" ? "bg-primary text-primary-foreground" : ""}`}>
                <Smartphone className="h-4 w-4" aria-hidden="true" /> Mobile
              </button>
            </div>
          </div>
          <CampaignTemplatePreview template={style} category={category} viewport={viewport} example />
          <div className="flex flex-wrap gap-3">
            <Link to={`/create?manual=1&category=${category}&template=${style}`} className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-primary px-5 font-semibold text-primary-foreground">
              Use this layout <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
            <p className="self-center text-xs text-muted-foreground">Opens the normal three-step editor with this category selected. Your existing draft is never overwritten.</p>
          </div>
        </section>
      </div>

      <p className="text-xs text-muted-foreground">
        Looking for a fundraiser hosted somewhere else? <Link to="/fundraising-partners" className="inline-flex min-h-11 items-center underline">See how iFund works alongside other platforms</Link>.
      </p>
    </main>
  );
}
