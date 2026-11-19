import { useEffect } from "react";
import { useLocation } from "react-router-dom";

const getHashId = (hash) => {
  try { return decodeURIComponent(hash.slice(1)); }
  catch { return hash.slice(1); }
};

const getScrollTarget = () =>
  document.querySelector("[data-page-scroll]") ||
  document.getElementById("root") ||
  document.scrollingElement ||
  document.documentElement;

const scrollToStart = () => {
  const target = getScrollTarget();
  if (target && "scrollTo" in target) target.scrollTo({ top: 0, left: 0, behavior: "auto" });
  else window.scrollTo({ top: 0, left: 0, behavior: "auto" });
};

export default function ScrollToTop() {
  const { pathname, hash } = useLocation();

  useEffect(() => {
    if (hash) {
      const id = getHashId(hash);
      const timer = window.setTimeout(() => {
        const target = document.getElementById(id);
        if (target) {
          const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches === true;
          target.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "start" });
        } else scrollToStart();
      }, 50);
      return () => window.clearTimeout(timer);
    }
    scrollToStart();
  }, [pathname, hash]);

  return null;
}
