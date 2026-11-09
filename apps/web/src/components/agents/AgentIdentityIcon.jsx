import React from "react";

/** Shared IFund agent identities. Presentation names are not backend permissions or IDs. */
export const AGENT_IDENTITIES = Object.freeze({
  nexus: { name: "NEXUS", role: "Chief of Staff", color: "#DCE3EB" },
  echo: { name: "ECHO", role: "Communications", color: "#409EFF" },
  pulse: { name: "PULSE", role: "Outreach", color: "#4DE2DB" },
  orbit: { name: "ORBIT", role: "Financial Growth", color: "#39D6A0" },
  polaris: { name: "POLARIS", role: "Strategy", color: "#A98BFF" },
  forge: { name: "FORGE", role: "Builder", color: "#FFB35B" },
  link: { name: "LINK", role: "Connections", color: "#8294FF" },
});
export function AgentIdentityIcon({ identity = "nexus", size = 48, className = "" }) {
  const color = AGENT_IDENTITIES[identity]?.color || AGENT_IDENTITIES.nexus.color;
  return <span className={"inline-flex shrink-0 items-center justify-center rounded-[25%] border border-white/15 " + className}
    style={{ width: size, height: size, background: "#0B0F14", boxShadow: "inset 0 1px 0 #ffffff12, 0 0 16px " + color + "22" }}>
    <svg width="72%" height="72%" viewBox="0 0 48 48" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" role="img" aria-label={AGENT_IDENTITIES[identity]?.name || "NEXUS"}>
      {identity === "nexus" && <><path d="M24 13 35 24 24 35 13 24Z"/><circle cx="24" cy="5" r="2.5"/><circle cx="43" cy="24" r="2.5"/><circle cx="24" cy="43" r="2.5"/><circle cx="5" cy="24" r="2.5"/><path d="M24 8v5M35 24h5M24 35v5M8 24h5"/></>}
      {identity === "echo" && <><path d="M23 19C18 9 6 11 6 22c0 9 9 12 16 5L30 19c7-7 12-3 12 5 0 11-12 12-17 2"/><path d="m6 24-1 10 8-5m29-5 1 10-8-5"/></>}
      {identity === "pulse" && <><circle cx="24" cy="24" r="3" fill={color} stroke="none"/><path d="M16 16a11 11 0 0 0 0 16m16-16a11 11 0 0 1 0 16M10 10a20 20 0 0 0 0 28m28-28a20 20 0 0 1 0 28"/></>}
      {identity === "orbit" && <><circle cx="23" cy="25" r="11"/><path d="M5 35c8 7 26-3 37-22m-13-2 13 2-1 12"/></>}
      {identity === "polaris" && <><circle cx="24" cy="24" r="19" strokeDasharray="9 6"/><path d="m24 6 4.5 13.5L42 24l-13.5 4.5L24 42l-4.5-13.5L6 24l13.5-4.5Z"/></>}
      {identity === "forge" && <><path d="m24 5 11 6v12l-11 6-11-6V11Zm0 0v12m-11-6 11 6 11-6M24 29v12l-11 6-11-6V29l11-6 11 6Zm11-6 11 6v12l-11 6-11-6V35"/></>}
      {identity === "link" && <><ellipse cx="24" cy="24" rx="21" ry="10" transform="rotate(-37 24 24)"/><ellipse cx="24" cy="24" rx="21" ry="10" transform="rotate(37 24 24)"/><circle cx="10" cy="34" r="3" fill={color}/><circle cx="38" cy="34" r="3" fill={color}/></>}
    </svg>
  </span>;
}
