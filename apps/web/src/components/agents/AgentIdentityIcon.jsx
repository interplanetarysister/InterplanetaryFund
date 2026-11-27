import React from "react";

/** Shared IFund agent identities. Presentation names are not backend permissions or IDs. */
export const AGENT_IDENTITIES = Object.freeze({
  nexus: { name: "NEXUS", role: "Chief of Staff", color: "#DCE3EB" },
  echo: { name: "ECHO", role: "Communications", color: "#409EFF" },
  pulse: { name: "PULSE", role: "Outreach", color: "#4DE2DB" },
  orbit: { name: "ORBIT", role: "Finance", color: "#39D6A0" },
  polaris: { name: "POLARIS", role: "Strategy", color: "#A98BFF" },
  forge: { name: "FORGE", role: "Growth", color: "#FFB35B" },
  link: { name: "LINK", role: "Managed Connections", color: "#8294FF" },
  story: { name: "STORY", role: "Campaign Writing", color: "#F5B5D3" },
  discover: { name: "DISCOVER", role: "Connection Discovery", color: "#9DE3FF" },
  reach: { name: "REACH", role: "Outreach, Connections & Growth", color: "#7EE787" },
});
export function AgentIdentityIcon({ identity = "nexus", size = 48, className = "" }) {
  const knownIdentity = Object.hasOwn(AGENT_IDENTITIES, identity) ? identity : "nexus";
  const color = AGENT_IDENTITIES[knownIdentity].color;
  const iconSize = Math.max(16, Math.round(Number(size) * 0.72) || 35);
  return <span className={"inline-flex shrink-0 items-center justify-center rounded-[25%] border border-white/15 " + className}
    style={{ width: size, height: size, background: "#0B0F14", boxShadow: "inset 0 1px 0 #ffffff12, 0 0 16px " + color + "22" }}>
    <svg width={iconSize} height={iconSize} viewBox="0 0 48 48" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" role="img" aria-label={AGENT_IDENTITIES[knownIdentity].name}>
      {knownIdentity === "nexus" && <><path d="M24 13 35 24 24 35 13 24Z"/><circle cx="24" cy="5" r="2.5"/><circle cx="43" cy="24" r="2.5"/><circle cx="24" cy="43" r="2.5"/><circle cx="5" cy="24" r="2.5"/><path d="M24 8v5M35 24h5M24 35v5M8 24h5"/></>}
      {knownIdentity === "echo" && <><path d="M23 19C18 9 6 11 6 22c0 9 9 12 16 5L30 19c7-7 12-3 12 5 0 11-12 12-17 2"/><path d="m6 24-1 10 8-5m29-5 1 10-8-5"/></>}
      {knownIdentity === "pulse" && <><circle cx="24" cy="24" r="3" fill={color} stroke="none"/><path d="M16 16a11 11 0 0 0 0 16m16-16a11 11 0 0 1 0 16M10 10a20 20 0 0 0 0 28m28-28a20 20 0 0 1 0 28"/></>}
      {knownIdentity === "orbit" && <><circle cx="23" cy="25" r="11"/><path d="M5 35c8 7 26-3 37-22m-13-2 13 2-1 12"/></>}
      {knownIdentity === "polaris" && <><circle cx="24" cy="24" r="19" strokeDasharray="9 6"/><path d="m24 6 4.5 13.5L42 24l-13.5 4.5L24 42l-4.5-13.5L6 24l13.5-4.5Z"/></>}
      {knownIdentity === "forge" && <><path d="m24 5 11 6v12l-11 6-11-6V11Zm0 0v12m-11-6 11 6 11-6M24 29v12l-11 6-11-6V29l11-6 11 6Zm11-6 11 6v12l-11 6-11-6V35"/></>}
      {knownIdentity === "story" && <><path d="M9 10h13c5 0 7 2 7 6v24c-3-2-6-3-10-3H9z"/><path d="M29 16c0-4 3-6 8-6h3v27c-5 0-8 1-11 3"/><path d="M14 20h8m-8 6h7m13-6h3m-3 6h3"/></>}
      {knownIdentity === "discover" && <><circle cx="24" cy="24" r="17"/><path d="M24 10v7m0 14v7M10 24h7m14 0h7"/><path d="m18 30 5-13 7-3-5 14-7 2Z"/></>}
      {knownIdentity === "link" && <><ellipse cx="24" cy="24" rx="21" ry="10" transform="rotate(-37 24 24)"/><ellipse cx="24" cy="24" rx="21" ry="10" transform="rotate(37 24 24)"/><circle cx="10" cy="34" r="3" fill={color}/><circle cx="38" cy="34" r="3" fill={color}/></>}
      {knownIdentity === "reach" && <><circle cx="17" cy="31" r="3" fill={color} stroke="none"/><path d="M17 28V17a14 14 0 0 1 14-7"/><path d="M17 22a9 9 0 0 1 9-9"/><path d="M31 5l12 12M43 9v8h-8"/></>}
    </svg>
  </span>;
}
