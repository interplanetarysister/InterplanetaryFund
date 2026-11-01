// Normalize only member-editable public profile fields. Never accept a role,
// owner ID, or authorization claim from a browser-submitted profile form.
export function normalizeProfileInput(input = {}) {
  const displayName = String(input.display_name ?? "").trim();
  const handle = String(input.handle ?? "").trim();
  if (displayName.length > 100) throw new Error("Display name must be 100 characters or fewer.");
  if (handle && !/^[A-Za-z0-9_-]{3,32}$/.test(handle)) {
    throw new Error("Handles must be 3–32 letters, numbers, underscores, or hyphens.");
  }
  return { display_name: displayName || null, handle: handle || null };
}
