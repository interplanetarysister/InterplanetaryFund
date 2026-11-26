import { Link } from "react-router-dom";

// Legal footer — copyright, disclaimer, and trust page links shown at the bottom of the platform.
export default function LegalFooter() {
  return (
    <footer className="text-center text-[11px] text-muted-foreground py-4 px-4 border-t border-border">
      <div className="flex flex-wrap items-center justify-center gap-2 mb-1">
        <Link to="/our-story" className="inline-flex min-h-11 items-center hover:text-foreground transition-colors">Our Story</Link>
        <span>·</span>
        <Link to="/about" className="inline-flex min-h-11 items-center hover:text-foreground transition-colors">About</Link>
        <span>·</span>
        <Link to="/contact" className="inline-flex min-h-11 items-center hover:text-foreground transition-colors">Contact</Link>
        <span>·</span>
        <Link to="/terms" className="inline-flex min-h-11 items-center hover:text-foreground transition-colors">Terms</Link>
        <span>·</span>
        <Link to="/privacy" className="inline-flex min-h-11 items-center hover:text-foreground transition-colors">Privacy</Link>
        <span>·</span>
        <Link to="/health-privacy" className="inline-flex min-h-11 items-center hover:text-foreground transition-colors">Health Privacy</Link>
        <span>·</span>
        <Link to="/help" className="inline-flex min-h-11 items-center hover:text-foreground transition-colors">Help & Legal</Link>
        <span>·</span>
        <Link to="/download" className="inline-flex min-h-11 items-center hover:text-foreground transition-colors">Get the app</Link>
        <span>·</span>
        <Link to="/templates" className="inline-flex min-h-11 items-center hover:text-foreground transition-colors">Templates</Link>
      </div>
      © 2026 <Link to="/help/copyright-and-intellectual-property"
        className="inline-flex min-h-11 items-center underline underline-offset-2 hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
        aria-label="Interplanetary Fund copyright and intellectual property information">Interplanetary Fund</Link>
      {" · "}All rights reserved ·{" "}
      <span className="italic">Donations are voluntary and may not reach campaign goals.</span>
    </footer>
  );
}