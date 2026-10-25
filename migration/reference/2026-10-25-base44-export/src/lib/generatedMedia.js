// Normalize the image generator result without mistaking an error or missing
// URL for an image. URL must be HTTPS or a legitimate browser image data URL.
export function resolveGeneratedImageUrl(payload) {
  const result = payload?.data || payload || {};
  const candidate = result?.url || result?.image_url || result?.imageUrl ||
    result?.images?.[0]?.url;
  if (typeof candidate !== "string" || !candidate.trim()) return "";
  const value = candidate.trim();
  if (/^data:image\/(?:png|jpe?g|webp|gif|svg\+xml);base64,[a-z\d+/=]+$/i.test(value)) {
    return value;
  }
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== "https:" || parsed.username || parsed.password) return "";
    return parsed.href;
  } catch {
    return "";
  }
}

export function loadGeneratedImage(url, timeoutMs = 18000) {
  return new Promise((resolve, reject) => {
    const image = new window.Image();
    let completed = false;
    const finish = (error) => {
      if (completed) return;
      completed = true;
      clearTimeout(timer);
      image.onload = null;
      image.onerror = null;
      if (error) reject(error); else resolve(url);
    };
    const timer = setTimeout(() => finish(new Error("Image load timed out")), timeoutMs);
    image.onload = async () => {
      if (!image.naturalWidth || !image.naturalHeight) {
        finish(new Error("The returned file was not an image"));
        return;
      }
      try {
        if (typeof image.decode === "function") await image.decode();
        finish();
      } catch { finish(new Error("Image could not be decoded")); }
    };
    image.onerror = () => finish(new Error("Image failed to load"));
    image.src = url;
  });
}
