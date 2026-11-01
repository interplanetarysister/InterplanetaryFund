import { Link } from "react-router-dom";

// Legal footer — copyright, disclaimer, and trust page links shown at the bottom of the platform.
export default function LegalFooter() {
  return (
    <footer className="text-center text-[11px] text-muted-foreground py-4 px-4 border-t border-border">
      <div className="flex items-center justify-center gap-2 mb-1">
        <Link to="/about" className="hover:text-foreground transition-colors">About</Link>
        <span>·</span>
        <Link to="/contact" className="hover:text-foreground transition-colors">Contact</Link>
        <span>·</span>
        <Link to="/terms" className="hover:text-foreground transition-colors">Terms</Link>
        <span>·</span>
        <Link to="/privacy" className="hover:text-foreground transition-colors">Privacy</Link>
        <span>·</span>
        <Link to="/help" className="hover:text-foreground transition-colors">Help & Legal</Link>
      </div>
      © 2026 <Link to="/help/copyright-and-intellectual-property"
        className="underline underline-offset-2 hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
        aria-label="Interplanetary Fund copyright and intellectual property information">Interplanetary Fund</Link>
      {" · "}All rights reserved ·{" "}
      <span className="italic">Donations are voluntary and may not reach campaign goals.</span>
    </footer>
  );
}