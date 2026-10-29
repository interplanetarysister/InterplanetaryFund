import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

// iOS-style edge-swipe-back: a touch starting within ~30px of the left edge
// that moves rightward by >70px (with little vertical drift) navigates back.
// Enabled on non-root pages for a native-feeling gesture.
export default function useSwipeBack(enabled = true, onBack) {
  const navigate = useNavigate();
  useEffect(() => {
    if (!enabled) return;
    let startX = null, startY = null;
    const onStart = (e) => {
      if (e.touches[0].clientX < 30) { startX = e.touches[0].clientX; startY = e.touches[0].clientY; }
    };
    const onEnd = (e) => {
      if (startX === null) return;
      const dx = e.changedTouches[0].clientX - startX;
      const dy = e.changedTouches[0].clientY - startY;
      if (dx > 70 && Math.abs(dy) < 40) {
        if (typeof onBack === "function") onBack();
        else if (Number.isInteger(window.history.state?.idx) && window.history.state.idx > 0) navigate(-1);
        else navigate("/", { replace: true });
      }
      startX = null; startY = null;
    };
    window.addEventListener("touchstart", onStart, { passive: true });
    window.addEventListener("touchend", onEnd);
    return () => {
      window.removeEventListener("touchstart", onStart);
      window.removeEventListener("touchend", onEnd);
    };
  }, [enabled, navigate, onBack]);
}