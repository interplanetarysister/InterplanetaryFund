const URLS = /https?:\/\/[^\s<>"']+/gi;
export function videoFromUrl(value) {
  try {
    const u = new URL(String(value || "").trim().replace(/[),.!?]+$/, ""));
    if (u.protocol !== "https:" || u.username || u.password) return null;
    const host = u.hostname.toLowerCase();
    let id = "";
    if (host === "youtu.be") id = u.pathname.slice(1).split("/")[0];
    else if (["youtube.com", "www.youtube.com", "m.youtube.com", "youtube-nocookie.com", "www.youtube-nocookie.com"].includes(host)) {
      if (u.pathname === "/watch") id = u.searchParams.get("v") || "";
      else if (/^\/(shorts|embed|live)\//.test(u.pathname)) id = u.pathname.split("/")[2] || "";
    }
    if (/^[a-zA-Z0-9_-]{11}$/.test(id)) return { type: "youtube", src: "https://www.youtube-nocookie.com/embed/" + id, url: u.href };
    if (/\.(mp4|webm|ogg)$/i.test(u.pathname)) return { type: "direct", src: u.href, url: u.href };
  } catch { /* invalid URL */ }
  return null;
}
export function videoFromText(body) {
  for (const url of String(body || "").match(URLS) || []) {
    const video = videoFromUrl(url);
    if (video) return video;
  }
  return null;
}
