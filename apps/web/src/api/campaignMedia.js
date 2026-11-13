// Browser-side upload contract. Cloudflare Pages verifies the session and writes bytes to R2.
// A successful HTTP response is not sufficient: require a confirmed same-origin media URL.
const MAX_BYTES = 5 * 1024 * 1024;
const MIME = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);
export async function uploadCampaignCover(client, file, { fetcher = fetch } = {}) {
  if (!file || !MIME.has(file.type)) throw new Error("Choose a PNG, JPG, WEBP, or GIF image.");
  if (!file.size || file.size > MAX_BYTES) throw new Error("Choose an image smaller than 5 MB.");
  const { data, error } = await client.auth.getSession();
  const token = data?.session?.access_token;
  const owner = data?.session?.user?.id;
  if (error || !token || !owner) throw new Error("Sign in before uploading your campaign cover.");
  const response = await fetcher("/api/media/campaign/upload", {
    method: "POST",
    headers: { authorization: "Bearer " + token, "content-type": file.type },
    body: file,
    signal: AbortSignal.timeout(25000),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || "Could not upload the image.");
  const { data: after, error: changed } = await client.auth.getSession();
  if (changed || after?.session?.user?.id !== owner)
    throw new Error("Your account changed. Please reopen this campaign before choosing an image.");
  const url = new URL(String(payload.url || ""), window.location.origin);
  if (url.origin !== window.location.origin ||
      url.username || url.password || url.search || url.hash ||
      !/^\/api\/media\/campaign\/[0-9a-f-]{36}\/[0-9a-f-]{36}\.(png|jpg|webp|gif)$/i.test(url.pathname) ||
      url.pathname.split("/")[4].toLowerCase() !== owner.toLowerCase())
    throw new Error("The upload did not return a verified image link.");
  return url.href;
}
