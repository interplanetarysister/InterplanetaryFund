// A provider OAuth button must never silently fall back to a public home page.
// This only validates the returned browser URL; the server still owns OAuth
// state, token exchange, user binding and verification.
export function providerAuthorizationDestination(rawUrl, officialHomepage = "") {
  if (typeof rawUrl !== "string" || !rawUrl.trim()) {
    throw new Error("Provider authorization did not return a link.");
  }
  let destination;
  try {
    destination = new URL(rawUrl);
  } catch {
    throw new Error("Provider authorization returned an invalid link.");
  }
  if (destination.protocol !== "https:" || destination.username || destination.password ||
      (destination.port && destination.port !== "443")) {
    throw new Error("Provider authorization returned an insecure link.");
  }
  // A plain origin cannot identify which app, permissions, or user initiated
  // authorization; this also protects services without a catalog homepage.
  if (destination.pathname === "/" && !destination.search && !destination.hash) {
    throw new Error("Provider authorization returned a homepage rather than a permissions link.");
  }
  if (officialHomepage) {
    const homepage = new URL(officialHomepage);
    const host = (value) => value.toLowerCase().replace(/^www\./, "");
    const isPublicHomepage = host(destination.hostname) === host(homepage.hostname) &&
      destination.pathname.replace(/\/+$/, "") === homepage.pathname.replace(/\/+$/, "") &&
      !destination.search && !destination.hash;
    if (isPublicHomepage) {
      throw new Error("Provider authorization returned a homepage rather than a permissions link.");
    }
  }
  return destination.href;
}
