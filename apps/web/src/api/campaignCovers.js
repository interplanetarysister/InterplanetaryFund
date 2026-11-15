// Authenticated cover-image upload. Public campaign covers are intended for
// publication; private documents must NEVER be uploaded into this bucket.
import { isVerifiedEmailUser } from "../lib/verifiedEmailUser.js";
import { payoutIdentity } from "../lib/guestAccess.js";
import { verifyAccountLifecycle } from "../lib/accountLifecycle.js";

export const COVER_BUCKET = "ifund-campaign-covers";
export const MAX_COVER_BYTES = 5 * 1024 * 1024;
const MEDIA_EXTENSIONS = Object.freeze({
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/avif": "avif",
});
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isVerifiedCoverOwner(user) {
  return Boolean(isVerifiedEmailUser(user) && payoutIdentity(user) && UUID.test(user?.id || ""));
}

export function validateCoverFile(file) {
  if (!file || typeof file.size !== "number" || file.size < 1 || file.size > MAX_COVER_BYTES)
    return "Select a cover image smaller than 5 MB.";
  if (!MEDIA_EXTENSIONS[file.type])
    return "Choose a JPG, PNG, WebP, or AVIF image.";
  return "";
}

export async function uploadCampaignCover(client, file, { makeId = () => crypto.randomUUID() } = {}) {
  const inputError = validateCoverFile(file);
  if (inputError) throw Error(inputError);
  const { data: session, error: sessionError } = await client.auth.getUser();
  const user = session?.user;
  if (sessionError || !isVerifiedCoverOwner(user))
    throw Error("Sign in with a confirmed email account to upload a campaign cover.");
  const lifecycle = await verifyAccountLifecycle(client, user);
  if (!lifecycle.ok) throw Error(lifecycle.message || "Your account could not be verified.");
  const fileId = makeId();
  if (!UUID.test(fileId)) throw Error("A secure image identifier could not be generated.");
  const path = `${user.id}/${fileId}.${MEDIA_EXTENSIONS[file.type]}`;
  const storage = client.storage.from(COVER_BUCKET);
  const { data: saved, error: uploadError } = await storage.upload(path, file, {
    cacheControl: "3600",
    contentType: file.type,
    upsert: false,
  });
  if (uploadError || saved?.path !== path)
    throw Error("Your cover image could not be uploaded. Please retry.");
  const { data: current, error: currentError } = await client.auth.getUser();
  if (currentError || current?.user?.id !== user.id)
    throw Error("Your session changed during the image upload. Sign in again.");
  const { data: publicData } = storage.getPublicUrl(path);
  const url = new URL(publicData?.publicUrl || "");
  const expectedOrigin = new URL(client.supabaseUrl || "");
  const expectedPath = `/storage/v1/object/public/${COVER_BUCKET}/${path}`;
  if (expectedOrigin.protocol !== "https:" || url.protocol !== "https:" ||
      url.origin !== expectedOrigin.origin || url.username || url.password ||
      url.pathname !== expectedPath || url.search || url.hash ||
      url.href.length > 2000) throw Error("The uploaded cover URL could not be verified.");
  return url.href;
}
