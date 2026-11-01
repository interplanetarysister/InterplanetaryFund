import { resolveGeneratedImageUrl } from "./generatedMedia";
import { brandAndUploadGeneratedImage } from "./ifundImageBranding";
import { createIfundPhotoTreatment } from "./ifundPhotoTreatment";

// The ONLY entry point for any user-uploaded IFund photo transformation.
// A real reference-image API is preferred. Offline source-preserving styling
// is always available and never claims to be AI generated.
export async function improveUploadedPhoto(base44, originalUrl) {
  let brandedSource = originalUrl;
  let mode = "photo_treatment";
  let temporaryUrl = null;
  try {
    const response = await base44.functions.invoke("renderInterplanetaryPhoto", {
      source_url: originalUrl,
    }).catch(() => null);
    const serverUrl = response?.data?.mode === "ai_photo_edit"
      ? resolveGeneratedImageUrl(response.data) : "";
    // Always use the user's actual photo as the full-opacity base.
    // A provider-generated edit contributes only gentle visual accents.
    const image = await createIfundPhotoTreatment(originalUrl, serverUrl || null);
    temporaryUrl = URL.createObjectURL(image);
    brandedSource = temporaryUrl;
    if (serverUrl) mode = "ai_photo_edit";
    const url = await brandAndUploadGeneratedImage(base44, brandedSource);
    return { url, mode };
  } finally {
    if (temporaryUrl) URL.revokeObjectURL(temporaryUrl);
  }
}
