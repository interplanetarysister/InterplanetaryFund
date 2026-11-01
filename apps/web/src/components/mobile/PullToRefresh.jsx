import React, { useRef, useState, useEffect } from "react";
import { Loader2 } from "lucide-react";

// Native-style pull-to-refresh that preserves ordinary one-finger scrolling.
// We never cancel touchmove: native vertical panning always wins. The refresh
// indicator simply observes a downward pull at scrollTop 0 and refreshes after
// release when the threshold is reached.
export default function PullToRefresh({ onRefresh, children, className = "" }) {
  const wrapRef = useRef(null);
  const startYRef = useRef(null);
  const startXRef = useRef(null);
  const pullRef = useRef(0);
  const refreshingRef = useRef(false);
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const THRESHOLD = 70;

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;

    const onStart = (e) => {
      if (refreshingRef.current) return;
      const scrollEl = el.closest("[data-page-scroll]") || document.getElementById("root") || document.scrollingElement || document.documentElement;
      if (scrollEl.scrollTop > 0) { startYRef.current = null; return; }
      startYRef.current = e.touches[0].clientY;
      startXRef.current = e.touches[0].clientX;
    };
    const onMove = (e) => {
      if (startYRef.current === null || refreshingRef.current) return;
      const dy = e.touches[0].clientY - startYRef.current;
      const dx = e.touches[0].clientX - (startXRef.current || 0);
      if (dy > 0 && Math.abs(dy) > Math.abs(dx)) {
        const p = Math.min(dy * 0.35, 90);
        pullRef.current = p;
        setPull(p);
      }
    };
    const onEnd = () => {
      if (startYRef.current === null) return;
      startYRef.current = null;
      startXRef.current = null;
      if (pullRef.current >= THRESHOLD && !refreshingRef.current) {
        refreshingRef.current = true;
        setRefreshing(true);
        setPull(THRESHOLD);
        pullRef.current = THRESHOLD;
        Promise.resolve(onRefresh?.()).finally(() => {
          refreshingRef.current = false;
          setRefreshing(false);
          setPull(0);
          pullRef.current = 0;
        });
      } else {
        setPull(0);
        pullRef.current = 0;
      }
    };

    el.addEventListener("touchstart", onStart, { passive: true });
    el.addEventListener("touchmove", onMove, { passive: true });
    el.addEventListener("touchend", onEnd);
    return () => {
      el.removeEventListener("touchstart", onStart);
      el.removeEventListener("touchmove", onMove);
      el.removeEventListener("touchend", onEnd);
    };
  }, [onRefresh]);

  return (
    <div ref={wrapRef} className={className} style={{ touchAction: "pan-y" }}>
      <div
        className="flex items-center justify-center overflow-hidden"
        style={{ height: refreshing ? THRESHOLD : pull, transition: refreshing ? "none" : "height 0.18s ease" }}
      >
        <Loader2 className="w-5 h-5 text-primary animate-spin" style={{ opacity: refreshing ? 1 : Math.min(pull / THRESHOLD, 1) }} />
      </div>
      {children}
    </div>
  );
}