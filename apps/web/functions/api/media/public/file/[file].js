import { routePublicPostMedia } from "../../../../../../../worker/media/publicPostMedia.js";

// Explicit same-origin Pages Function; serves private R2 library bytes
// publicly only while the file is attached to a visible social post.
export function onRequest({ request, env }) {
  return routePublicPostMedia(request, env);
}
