import { useEffect, useState } from "react";
import { ArrowUp } from "lucide-react";

const getScrollTarget = () =>
  document.querySelector("[data-page-scroll]") ||
  document.getElementById("root") ||
  document.scrollingElement ||
  document.documentElement;

export default function BackToTop() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const target = getScrollTarget();
    if (!target) return;
    const onScroll = () => setShow((target.scrollTop || 0) > 500);
    onScroll();
    target.addEventListener("scroll", onScroll, { passive: true });
    return () => target.removeEventListener("scroll", onScroll);
  }, []);

  if (!show) return null;

  return (
    <button
      type="button"
      onClick={() => {
        const target = getScrollTarget();
        if (target && "scrollTo" in target) target.scrollTo({ top: 0, behavior: "smooth" });
        else window.scrollTo({ top: 0, behavior: "smooth" });
      }}
      className="fixed bottom-[calc(5.5rem+env(safe-area-inset-bottom))] md:bottom-6 right-4 z-30 w-11 h-11 rounded-full bg-cyan-500 text-slate-950 shadow-lg flex items-center justify-center hover:bg-cyan-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 transition-colors"
      aria-label="Back to top"
    >
      <ArrowUp className="w-5 h-5" />
    </button>
  );
}
