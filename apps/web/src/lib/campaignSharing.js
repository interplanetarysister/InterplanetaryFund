// Public URL construction is deliberately independent of creator input.
// Only canonical UUID campaign identifiers are accepted.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function campaignPublicUrl(origin, id) {
  if (!UUID.test(String(id || ""))) throw new Error("Invalid campaign ID");
  const url = new URL(origin);
  if (url.protocol !== "https:" && !(url.hostname === "localhost" && url.protocol === "http:"))
    throw new Error("Secure website origin required");
  if (url.username || url.password || url.search || url.hash) throw new Error("Invalid origin");
  return url.origin + "/campaign/" + id;
}

export function campaignEmbedCode(origin, id) {
  const publicUrl = campaignPublicUrl(origin, id);
  const embedUrl = publicUrl.replace("/campaign/", "/embed/campaign/");
  return '<iframe title="Interplanetary Fund campaign" src="' + embedUrl +
    '" width="360" height="460" loading="lazy" referrerpolicy="strict-origin-when-cross-origin" ' +
    'style="max-width:100%;border:0" ></iframe>';
}
