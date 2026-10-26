import { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";

// One in-flight request shared by component instances; an app tab refetches
// when focused or when an admin changes a flag. This is NOT an access check.
let snapshot = null;
let lastFetched = 0;
let inFlight = null;
const subscribers = new Set();
const send = () => { for (const fn of subscribers) fn(snapshot || {}); };
async function refresh(force = false) {
  if (!force && snapshot && Date.now() - lastFetched < 15000) return snapshot;
  if (inFlight) return inFlight;
  inFlight = base44.functions.invoke("getFeatureAvailability", {})
    .then(({ data }) => {
      snapshot = data?.available && typeof data.available === "object" ? data.available : {};
      lastFetched = Date.now();
      send();
      return snapshot;
    })
    .catch(() => {
      snapshot = {};
      lastFetched = Date.now();
      send();
      return snapshot;
    }).finally(() => { inFlight = null; });
  return inFlight;
}
let listening = false;
function ensureListeners() {
  if (listening) return;
  listening = true;
  window.addEventListener("focus", () => refresh(true));
  window.addEventListener("ifund:fundraising-mode-changed", () => refresh(true));
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") refresh(true);
  });
}

export function useFeatureEnabled(key) {
  const [enabled, setEnabled] = useState(snapshot?.[key] === true);
  useEffect(() => {
    ensureListeners();
    const update = (state) => setEnabled(state?.[key] === true);
    subscribers.add(update);
    refresh();
    return () => { subscribers.delete(update); };
  }, [key]);
  return enabled;
}
