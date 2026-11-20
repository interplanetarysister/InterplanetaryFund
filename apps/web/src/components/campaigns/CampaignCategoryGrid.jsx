import React from "react";
import { Link } from "react-router-dom";
import {
  GraduationCap, HeartPulse, Leaf, LifeBuoy, Palette, PawPrint, Shield,
  Sparkles, Store, Users, Flower2, ArrowUpRight,
} from "lucide-react";
import { TEMPLATE_CATEGORIES } from "@/lib/campaignTemplates";

const GLYPHS = Object.freeze({
  "life-buoy": LifeBuoy,
  "heart-pulse": HeartPulse,
  users: Users,
  "graduation-cap": GraduationCap,
  "paw-print": PawPrint,
  store: Store,
  palette: Palette,
  leaf: Leaf,
  shield: Shield,
  flower: Flower2,
  sparkles: Sparkles,
});

export function CategoryGlyph({ icon, className = "" }) {
  const Glyph = GLYPHS[icon] || Sparkles;
  return <Glyph className={className} aria-hidden="true" />;
}

/**
 * The shared category artwork used on the homepage, the template gallery and
 * the campaign editor. Buttons and links keep a 44px+ target on touch screens.
 */
export default function CampaignCategoryGrid({
  activeCategory = null,
  onSelect = null,
  linkTo = null,
  limit = null,
  columns = "sm:grid-cols-2 lg:grid-cols-3",
  headingLevel = 3,
}) {
  const items = limit ? TEMPLATE_CATEGORIES.slice(0, limit) : TEMPLATE_CATEGORIES;
  const Heading = `h${headingLevel}`;
  return (
    <div className={`grid gap-3 ${columns}`}>
      {items.map((category) => {
        const active = activeCategory === category.id;
        const body = (
          <>
            <span
              className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-white/40 bg-gradient-to-br ${category.gradient} shadow-sm`}
            >
              <CategoryGlyph icon={category.icon} className="h-6 w-6 text-foreground" />
            </span>
            <span className="min-w-0 flex-1">
              <Heading className="font-semibold text-foreground">{category.label}</Heading>
              <span className="mt-1 block text-sm leading-snug text-muted-foreground">{category.blurb}</span>
            </span>
            <ArrowUpRight className="h-4 w-4 shrink-0 self-start text-muted-foreground" aria-hidden="true" />
          </>
        );
        const className = [
          "ifund-tap group flex min-h-[92px] items-start gap-3 rounded-2xl border p-4 text-left transition",
          active
            ? "border-cyan-400 bg-cyan-400/10 shadow-[0_0_0_1px_rgba(34,211,238,0.25)]"
            : "border-border bg-card hover:-translate-y-0.5 hover:border-cyan-400/60 hover:shadow-lg",
        ].join(" ");
        if (linkTo) {
          return (
            <Link key={category.id} to={linkTo(category.id)} className={className} aria-current={active ? "page" : undefined}>
              {body}
            </Link>
          );
        }
        return (
          <button
            key={category.id}
            type="button"
            onClick={() => onSelect?.(category.id)}
            aria-pressed={active}
            className={className}
          >
            {body}
          </button>
        );
      })}
    </div>
  );
}
