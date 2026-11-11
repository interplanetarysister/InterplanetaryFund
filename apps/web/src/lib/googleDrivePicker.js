const SCOPE = "https://www.googleapis.com/auth/drive.file";
const config = import.meta.env || {};
const clientId = config.VITE_GOOGLE_DRIVE_CLIENT_ID;
const developerKey = config.VITE_GOOGLE_DRIVE_PICKER_KEY;
const appId = config.VITE_GOOGLE_DRIVE_PROJECT_NUMBER;

export const drivePickerConfigured = Boolean(clientId && developerKey && /^\d+$/.test(appId || ""));
export const driveImageTypes = "image/jpeg,image/png,image/webp";

let loading;
function script(src) {
  return new Promise((resolve, reject) => {
    const element = document.createElement("script");
    const timer = setTimeout(fail, 12000);
    function fail() {
      clearTimeout(timer);
      element.remove();
      reject(new Error("Google Drive could not load."));
    }
    element.src = src;
    element.async = true;
    element.onload = () => { clearTimeout(timer); resolve(); };
    element.onerror = fail;
    document.head.appendChild(element);
  });
}

export function loadDrivePicker() {
  if (!loading) loading = Promise.all([
    window.google?.accounts?.oauth2 || script("https://accounts.google.com/gsi/client"),
    window.gapi || script("https://apis.google.com/js/api.js"),
  ]).then(() => {
    if (window.google?.picker) return;
    return new Promise((resolve, reject) => {
      window.gapi.load("picker", {
        callback: resolve,
        onerror: () => reject(new Error("Google Drive could not load.")),
        timeout: 12000,
        ontimeout: () => reject(new Error("Google Drive took too long to load.")),
      });
    });
  }).catch(error => { loading = null; throw error; });
  return loading;
}

export async function fetchDriveImage(token, id, maxBytes, signal, fetcher = fetch) {
  if (typeof id !== "string" || !/^[A-Za-z0-9_-]{1,256}$/.test(id)) {
    throw new Error("Google Drive returned an invalid file.");
  }
  const url = new URL("https://www.googleapis.com/drive/v3/files/" + id);
  url.searchParams.set("alt", "media");
  url.searchParams.set("supportsAllDrives", "true");
  const response = await fetcher(url, {
    headers: { Authorization: "Bearer " + token },
    cache: "no-store", redirect: "error", signal,
  });
  if (!response.ok || !response.body) throw new Error("Google Drive could not download that file.");
  const type = response.headers.get("content-type")?.split(";")[0].trim().toLowerCase();
  if (!driveImageTypes.split(",").includes(type)) {
    await response.body.cancel();
    throw new Error("Choose a JPEG, PNG, or WebP image.");
  }
  const sizeError = () => new Error("Choose an image up to " + (maxBytes / (1024 * 1024)) + " MB.");
  if (Number(response.headers.get("content-length")) > maxBytes) {
    await response.body.cancel();
    throw sizeError();
  }
  const reader = response.body.getReader();
  const chunks = [];
  let bytes = 0;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    bytes += value.byteLength;
    if (bytes > maxBytes) {
      await reader.cancel();
      throw sizeError();
    }
    chunks.push(value);
  }
  if (!bytes) throw new Error("The selected image is empty.");
  const extension = type === "image/jpeg" ? "jpg" : type.split("/")[1];
  return new File(chunks, "drive-image." + extension, { type });
}

// Called directly from a click after preloading, so the browser permits the OAuth popup.
export function pickDriveImage(maxBytes, signal) {
  const google = window.google;
  return new Promise((resolve, reject) => {
    signal.throwIfAborted();
    let picker;
    let tokenReceived = false;
    let finished = false;
    let downloading = false;
    const timeout = setTimeout(() => finish(new Error("Google Drive did not respond. Try again.")), 120000);
    const abort = () => finish(signal.reason);
    function finish(error, file) {
      if (finished) return;
      finished = true;
      clearTimeout(timeout);
      signal.removeEventListener("abort", abort);
      picker?.setVisible(false);
      if (error) reject(error);
      else resolve(file);
    }
    signal.addEventListener("abort", abort, { once: true });
    try {
      google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: SCOPE,
        include_granted_scopes: false,
        error_callback: result => {
          if (result.type === "popup_closed") finish(null, null);
          else finish(new Error("Google authorization could not open. Check your popup settings."));
        },
        callback: response => {
          if (finished || signal.aborted || tokenReceived) return;
          tokenReceived = true;
          if (response.error || !response.access_token ||
              !google.accounts.oauth2.hasGrantedAllScopes(response, SCOPE)) {
            finish(new Error("Google Drive access was declined or unavailable."));
            return;
          }
          try {
            const api = google.picker;
            const view = new api.DocsView().setMimeTypes(driveImageTypes);
            picker = new api.PickerBuilder()
              .addView(view)
              .setAppId(appId)
              .setDeveloperKey(developerKey)
              .setOAuthToken(response.access_token)
              .setOrigin(window.location.origin)
              .setCallback(data => {
                if (finished || signal.aborted || downloading) return;
                if (data.action === api.Action.CANCEL) finish(null, null);
                if (data.action === api.Action.PICKED) {
                  downloading = true;
                  fetchDriveImage(response.access_token, data.docs?.[0]?.id, maxBytes, AbortSignal.any([signal, AbortSignal.timeout(30000)]))
                    .then(file => finish(null, file), error => finish(error));
                }
              }).build();
            picker.setVisible(true);
          } catch { finish(new Error("Google Drive file selection could not open.")); }
        },
      }).requestAccessToken({ prompt: "select_account" });
    } catch { finish(new Error("Google Drive authorization could not start.")); }
  });
}
