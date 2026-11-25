import { useEffect } from "react";

// Sprint 3 (2026-11-25): standalone public pages (Our Story, Terms, Privacy,
// Health Privacy) render OUTSIDE <Layout />, so Layout's per-route
// document.title effect never runs for them and they all inherit the
// homepage title. This hook gives a standalone page its own distinct title.
export default function useDocumentTitle(title) {
  useEffect(() => {
    document.title = title ? `${title} — Interplanetary Fund` : "Interplanetary Fund — What If?";
  }, [title]);
}
