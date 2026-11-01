import React from "react";
import { Image } from "@/components/ui/image";
import { BRAND_MARK } from "@/components/brand/brand";

// The Interplanetary Fund brand mark — the official logo, used everywhere the
// brand appears so it stays consistent across navigation, auth, and marketing.
export default function BrandLogo({ size = "md", showName = true, className = "", nameClassName = "" }) {
  const dims = {
    sm: { box: "w-8 h-8 rounded-lg", text: "text-base" },
    md: { box: "w-9 h-9 rounded-xl", text: "text-lg" },
    lg: { box: "w-14 h-14 rounded-2xl", text: "text-2xl" }
  }[size];

  return (
    <span className={`flex items-center gap-2.5 ${className}`}>
      <Image src={BRAND_MARK}

      alt="Interplanetary Fund logo"
      className={`${dims.box} shrink-0 object-cover shadow-lg shadow-blue-500/25`} />
      
      {showName &&
      <span className={`font-display ${dims.text} tracking-tight leading-none ${nameClassName || "text-slate-100"}`}>
          Interplanetary Fund
        </span>
      }
    </span>);

}