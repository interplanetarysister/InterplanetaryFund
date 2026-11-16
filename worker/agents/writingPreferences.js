export class WritingPreferencesError extends Error {
  constructor() {
    super("Use a writing tone of up to 200 characters and instructions of up to 2,000 characters.");
    this.status = 400;
  }
}

// Organizer-supplied style data grants no new tool, account or financial rights.
export function normalizeWritingPreferences(raw) {
  if (raw === undefined) return undefined;
  if (!raw || typeof raw !== "object" || Array.isArray(raw) ||
      Object.keys(raw).some(key => !["tone", "never_change"].includes(key)))
    throw new WritingPreferencesError();
  const result = {};
  for (const [key, limit] of [["tone", 200], ["never_change", 2000]]) {
    const value = raw[key] ?? "";
    if (typeof value !== "string" || value.length > limit ||
        /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value))
      throw new WritingPreferencesError();
    result[key] = value.trim();
  }
  return result.tone || result.never_change ? result : undefined;
}
