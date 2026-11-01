// Copy in secure browsers; return false and leave the visible text selected
// when a device or WebView blocks clipboard access.
export async function copyText(text, element) {
  const value = String(text || "");
  if (!value) return false;
  if (globalThis.navigator?.clipboard?.writeText) {
    try { await navigator.clipboard.writeText(value); return true; } catch { /* fallback */ }
  }
  if (element?.select) {
    element.focus();
    element.select();
    element.setSelectionRange?.(0, value.length);
  }
  try {
    return Boolean(globalThis.document?.execCommand?.("copy"));
  } catch { return false; }
}
