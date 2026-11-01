import React, { useState } from "react";

// Decorative brand marks are for recognition, not proof of a live integration.
// Show legible initials when a mark is unavailable (including offline mode).
const BRAND_SLUGS = {
  wordpress_com: "wordpress", google_photos: "googlephotos",
  google_contacts: "googlecontacts", outlook: "microsoftoutlook",
  microsoft_teams: "microsoftteams", one_drive: "onedrive",
};
const LOCAL_LOGOS = {
  bluesky: "svg", buymeacoffee: "svg", eventbrite: "svg", facebook: "svg",
  fundrazr: "png", givesendgo: "png", gofundme: "svg", gumroad: "svg",
  indiegogo: "png", instagram: "svg", justgiving: "svg", kickstarter: "svg",
  kofi: "svg", mastodon: "svg", patreon: "svg", spotfund: "png",
  wordpress_com: "svg",
};
const UNAVAILABLE_LOGOS = new Set(["custom", "google_contacts", "one_drive"]);

export default function PlatformLogo({ platform, className = "" }) {
  const [failed, setFailed] = useState(false);
  const name = String(platform?.name || platform?.id || "Platform");
  const id = String(platform?.id || "").toLowerCase();
  const slug = BRAND_SLUGS[id] || id;
  const imageSrc = LOCAL_LOGOS[id]
    ? `/platform-logos/${id}.${LOCAL_LOGOS[id]}`
    : UNAVAILABLE_LOGOS.has(id) ? null : `https://api.iconify.design/simple-icons/${slug}.svg`;
  const initials = name.replace(/[^a-zA-Z0-9 ]/g, "").split(/\s+/).filter(Boolean).slice(0, 2).map((word) => word[0]).join("").toUpperCase() || name.slice(0, 2).toUpperCase();
  return (
    <span className={`ifund-platform-logo inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-slate-200/70 bg-white text-sm font-extrabold text-slate-700 shadow-sm ${className}`}
          style={{ "--brand-accent": platform?.color || "#7059d7" }} aria-hidden="true">
      {imageSrc && !failed
        ? <img src={imageSrc} alt="" loading="lazy" referrerPolicy="no-referrer"
               onError={() => setFailed(true)} className="h-7 w-7 object-contain" />
        : <span>{initials}</span>}
    </span>
  );
}
