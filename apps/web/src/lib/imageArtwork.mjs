const MAX_OUTPUT_BYTES = 5 * 1024 * 1024;
const MAX_REFERENCE_BYTES = 786_432;
const ALLOWED_INPUTS = new Set(["image/jpeg", "image/png", "image/webp", "image/avif"]);

/** Verify the provider's image output before it can be previewed or uploaded. */
export function decodeGeneratedArtwork(result) {
  const base64 = result?.image_base64;
  if (result?.generated !== true || result?.mime_type !== "image/jpeg" ||
      typeof base64 !== "string" || base64.length < 64 || base64.length > 7_000_000 ||
      base64.length % 4 !== 0 || !base64.startsWith("/9j/") ||
      !/^[A-Za-z0-9+/]+={0,2}$/.test(base64))
    throw new Error("The generated image response could not be verified.");
  let binary;
  try { binary = atob(base64); }
  catch { throw new Error("The generated image could not be decoded."); }
  if (binary.length < 64 || binary.length > MAX_OUTPUT_BYTES ||
      binary.charCodeAt(0) !== 0xff || binary.charCodeAt(1) !== 0xd8 ||
      binary.charCodeAt(2) !== 0xff)
    throw new Error("The generated image was too large or incomplete.");
  return Uint8Array.from(binary, char => char.charCodeAt(0));
}

/** Downscale and strip uploaded metadata before explicit AI image editing.
 * The Cloudflare model requires reference images smaller than 512×512.
 * This helper only uses the user's selected local file, never a fetched URL.
 */
export async function prepareReferenceJpeg(file) {
  if (!file || typeof file.size !== "number" || file.size < 1 ||
      file.size > MAX_OUTPUT_BYTES || !ALLOWED_INPUTS.has(file.type))
    throw new Error("Choose a JPG, PNG, WebP or AVIF image smaller than 5 MB.");
  const objectUrl = URL.createObjectURL(file);
  try {
    const image = new Image();
    await new Promise((resolve, reject) => {
      image.onload = resolve;
      image.onerror = () => reject(new Error("The image could not be opened on this device."));
      image.src = objectUrl;
    });
    const width = image.naturalWidth, height = image.naturalHeight;
    if (!Number.isSafeInteger(width) || !Number.isSafeInteger(height) ||
        width < 1 || height < 1 || width * height > 80_000_000)
      throw new Error("The selected image dimensions are not supported.");
    const scale = Math.min(1, 480 / width, 480 / height);
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.floor(width * scale));
    canvas.height = Math.max(1, Math.floor(height * scale));
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) throw new Error("Image conversion is unavailable on this device.");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    const data = canvas.toDataURL("image/jpeg", 0.82);
    const prefix = "data:image/jpeg;base64,";
    if (!data.startsWith(prefix))
      throw new Error("This device could not create a JPEG image.");
    const reference = data.slice(prefix.length);
    if (reference.length < 64 || reference.length > 1_050_000 ||
        reference.length % 4 !== 0 || !reference.startsWith("/9j/") ||
        !/^[A-Za-z0-9+/]+={0,2}$/.test(reference))
      throw new Error("The reference image is still too large. Choose a smaller image.");
    const padding = reference.endsWith("==") ? 2 : reference.endsWith("=") ? 1 : 0;
    if ((reference.length * 3 / 4 - padding) > MAX_REFERENCE_BYTES)
      throw new Error("The reference image exceeds the supported AI image limit.");
    return { reference_jpeg: reference, width: canvas.width, height: canvas.height };
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}
