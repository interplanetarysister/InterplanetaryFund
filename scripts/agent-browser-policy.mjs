/** Restrict unsupervised browser checks to iFund; this does not grant agent permissions. */
const HOSTS = new Set(["interplanetaryfund.com","www.interplanetaryfund.com","preview.interplanetaryfund.com"]);
const LOOPBACK = new Set(["localhost","127.0.0.1","[::1]"]);
const READ = new Set(["GET","HEAD","OPTIONS"]);
export function browserTarget(value) {
  let url;
  try { url = new URL(value); } catch { throw Error("Absolute URL required."); }
  const local = LOOPBACK.has(url.hostname.toLowerCase());
  if (!["https:","http:"].includes(url.protocol) || (!local && url.protocol !== "https:") ||
      (!local && !HOSTS.has(url.hostname.toLowerCase())) ||
      (!local && url.port && url.port !== "443") ||
      url.username || url.password || url.hash)
    throw Error("Browser target is not an approved iFund origin.");
  return url;
}
export function permittedReadRequest(value, method, target) {
  if (!READ.has(String(method).toUpperCase())) return false;
  let url;
  try { url = new URL(value); } catch { return false; }
  if (!["http:","https:"].includes(url.protocol) || url.username || url.password) return false;
  if (url.origin === browserTarget(target).origin) return true;
  return url.protocol === "https:" && url.hostname === "ssibsfmtodgximseeqsv.supabase.co" && !url.port;
}
export function safeAuditPath(value) {
  const u = browserTarget(value);
  return u.origin + u.pathname;
}
