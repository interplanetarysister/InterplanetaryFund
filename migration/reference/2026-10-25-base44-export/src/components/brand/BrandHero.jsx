import React from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Image } from "@/components/ui/image";
import { Sparkles, Compass, Globe2, ShieldCheck, LifeBuoy } from "lucide-react";
import BrandLogo from "@/components/brand/BrandLogo";
import { SLOGAN, SLOGAN_LONG, BRAND_PROMISES, ACCOUNT_CTA } from "@/components/brand/brand";

const HERO_IMAGE = "https://media.base44.com/images/public/6a67a778342a8fe05ee79cba/b8b47ec6a_generated_image.png";

// The emotional first impression: deep space, the "What If?" promise, and the
// two ways anyone can take part — ask for support, or make it possible.
export default function BrandHero({ firstName }) {
  return (
    <section className="relative overflow-hidden rounded-3xl mb-8 bg-slate-950">
      <Image
        src={HERO_IMAGE}
        alt="A glowing planet arc surrounded by stars and soft nebula light"
        className="absolute inset-0 w-full h-full opacity-70"
        fittingType="fill"
        focalPointX={0.7}
        focalPointY={0.6}
      />
      <div className="absolute inset-0 bg-gradient-to-r from-slate-950 via-slate-950/85 to-slate-950/30" />

      <div className="relative px-6 sm:px-10 py-10 sm:py-14 max-w-2xl">
        <BrandLogo size="sm" className="mb-6" nameClassName="text-slate-100 text-sm sm:text-base" />

        <p className="text-xs font-medium uppercase tracking-[0.2em] text-cyan-300/80 mb-3">
          {firstName ? `Welcome back, ${firstName}` : "Welcome"}
        </p>

        <h1 className="font-display text-4xl sm:text-6xl leading-[1.05] text-white mb-4">
          <span className="bg-gradient-to-r from-cyan-300 via-blue-400 to-violet-400 bg-clip-text text-transparent">
            {SLOGAN}
          </span>
        </h1>

        <p className="text-slate-200 text-base sm:text-lg leading-relaxed mb-3 max-w-xl">
          One idea can change a life. One act of kindness can change a future.
        </p>
        <p className="text-slate-400 text-sm sm:text-base leading-relaxed mb-2 max-w-xl">
          Anyone can ask for help. Anyone can help. Our AI connects your cause to supporters worldwide.
        </p>
        <p className="font-display text-sm sm:text-base text-cyan-300/90 mb-7 max-w-xl">
          {SLOGAN_LONG}.
        </p>

        <div className="flex flex-wrap gap-3 mb-8">
          <Link to="/create">
            <Button className="rounded-xl bg-gradient-to-r from-cyan-400 to-blue-600 text-white border-0 shadow-lg shadow-blue-500/25 hover:opacity-90">
              <Sparkles className="w-4 h-4 mr-2" /> {ACCOUNT_CTA}
            </Button>
          </Link>
          <Link to="/discover">
            <Button variant="outline" className="rounded-xl border-white/20 bg-white/5 text-slate-100 hover:bg-white/10 hover:text-white">
              <Compass className="w-4 h-4 mr-2" /> Explore causes
            </Button>
          </Link>
        </div>

        <ul className="grid sm:grid-cols-2 gap-x-6 gap-y-2 mb-8">
          {BRAND_PROMISES.map((promise) => (
            <li key={promise} className="flex items-start gap-2 text-[13px] text-slate-400 leading-snug">
              <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-cyan-400 shrink-0 shadow-[0_0_8px_rgba(34,211,238,0.8)]" />
              {promise}
            </li>
          ))}
        </ul>

        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-[11px] text-slate-500">
          <span className="flex items-center gap-1.5"><Globe2 className="w-3.5 h-3.5 text-cyan-400" /> Global reach</span>
          <span className="flex items-center gap-1.5"><LifeBuoy className="w-3.5 h-3.5 text-cyan-400" /> Emergency support</span>
          <span className="flex items-center gap-1.5"><ShieldCheck className="w-3.5 h-3.5 text-cyan-400" /> Secure, trusted giving</span>
        </div>
      </div>
    </section>
  );
}