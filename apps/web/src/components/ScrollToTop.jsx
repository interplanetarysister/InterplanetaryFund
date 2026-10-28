import { useEffect } from "react";
import { useLocation } from "react-router-dom";

const getHashId = (hash) => {
  const rawId = hash.slice(1);

  try {
    return decodeURIComponent(rawId);
  } catch {
    return rawId;
  }
};

const getScrollTarget = () =>
  document.querySelector("[data-page-scroll]") ||
  document.getElementById("root") ||
  document.scrollingElement ||
  document.documentElement;

export default function ScrollToTop() {
  const { pathname, hash } = useLocation();

  useEffect(() => {

    if (hash) {
      const id = getHashId(hash);
      const timer = window.setTimeout(() => {
        document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
      }, 50);
      return () => window.clearTimeout(timer);
    }

    const target = getScrollTarget();
    if (target && "scrollTo" in target) target.scrollTo({ top: 0, left: 0, behavior: "instant" });
    else window.scrollTo({ top: 0, left: 0, behavior: "instant" });
  }, [pathname, hash]);

  return null;
}
