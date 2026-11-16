// Public clips only. Provider URLs are reconstructed; tracking/query credentials
// from a published link never become iframe parameters. Direct file sources
// require an independently approved public origin AND path prefix.
const URLS = /https?:\/\/[^\s<>"']+/gi;
const YOUTUBE = new Set(["youtube.com", "www.youtube.com", "m.youtube.com", "youtube-nocookie.com", "www.youtube-nocookie.com"]);
const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;
const MAX_URL_LENGTH = 2000;

function approvedDirectSource(url, sources) {
  if (!/\.(?:mp4|webm|ogg)$/i.test(url.pathname) || url.search || url.hash) return false;
  return Array.isArray(sources) && sources.some(source => {
    try {
      const origin = new URL(source.origin);
      const prefix = source.pathPrefix;
      return origin.protocol === "https:" && !origin.username && !origin.password && !origin.port &&
        origin.href === origin.origin + "/" && origin.origin === url.origin &&
        !/^(?:localhost|.*\.localhost|.*\.local|\d+(?:\.\d+){3}|\[.*\])$/i.test(origin.hostname) &&
        typeof prefix === "string" && /^\/[A-Za-z0-9/_-]+\/$/.test(prefix) &&
        url.pathname.startsWith(prefix) && !/%|\\/.test(url.pathname);
    } catch { return false; }
  });
}

export function videoFromUrl(value, { directSources = [] } = {}) {
  if (typeof value !== "string" || !value || value.length > MAX_URL_LENGTH || /[\u0000-\u0020\\]/.test(value)) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password || url.port) return null;
    const host = url.hostname.toLowerCase();
    let id = "";
    if (host === "youtu.be" && /^\/[A-Za-z0-9_-]{11}\/?$/.test(url.pathname)) id = url.pathname.split("/")[1];
    else if (YOUTUBE.has(host)) {
      if (url.pathname === "/watch" && url.searchParams.getAll("v").length === 1) id = url.searchParams.get("v");
      else {
        const match = url.pathname.match(/^\/(?:shorts|embed|live)\/([A-Za-z0-9_-]{11})\/?$/);
        if (match) id = match[1];
      }
    }
    if (VIDEO_ID.test(id)) return {
      type: "youtube", provider: "YouTube", src: "https://www.youtube-nocookie.com/embed/" + id,
      url: "https://www.youtube.com/watch?v=" + id,
    };
    if (["vimeo.com", "www.vimeo.com", "player.vimeo.com"].includes(host)) {
      const match = url.pathname.match(host === "player.vimeo.com" ? /^\/video\/([1-9][0-9]{5,11})\/?$/ : /^\/([1-9][0-9]{5,11})\/?$/);
      if (match) return {
        type: "vimeo", provider: "Vimeo", src: "https://player.vimeo.com/video/" + match[1] + "?dnt=1",
        url: "https://vimeo.com/" + match[1],
      };
    }
    if (approvedDirectSource(url, directSources)) return { type: "direct", provider: "IFund public video", src: url.href, url: url.href };
  } catch { /* Not an approved public video URL. */ }
  return null;
}

export function videoFromText(value, options) {
  if (typeof value !== "string") return null;
  for (const token of value.slice(0, 20000).match(URLS) || []) {
    const video = videoFromUrl(token.replace(/[),.!?\]}]+$/, ""), options);
    if (video) return video;
  }
  return null;
}

export function clipDescription(value) {
  return typeof value === "string" ? value.replace(URLS, "").replace(/\s+/g, " ").trim().slice(0, 350) : "";
}
