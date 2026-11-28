export class WritingPreferencesError extends Error {
  constructor() {
    super("Use a writing tone of up to 200 characters, instructions of up to 2,000 characters, and a version direction of up to 300 characters.");
    this.status = 400;
  }
}

// Organizer-supplied style data grants no new tool, account or financial rights.
// "adjustment" is the organizer's direction for one new version of a draft
// (shorter, more urgent, emphasize a fact). It is optional and is only
// present in the normalized result when supplied, so requests that do not
// use it keep the exact preference shape — and Story replay hash — they
// have always had.
export function normalizeWritingPreferences(raw) {
  if (raw === undefined) return undefined;
  if (!raw || typeof raw !== "object" || Array.isArray(raw) ||
      Object.keys(raw).some(key => !["tone", "never_change", "adjustment"].includes(key)))
    throw new WritingPreferencesError();
  const result = {};
  for (const [key, limit] of [["tone", 200], ["never_change", 2000], ["adjustment", 300]]) {
    const value = raw[key] ?? "";
    if (typeof value !== "string" || value.length > limit ||
        /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value))
      throw new WritingPreferencesError();
    if (key === "adjustment") {
      if (value.trim()) result.adjustment = value.trim();
    } else {
      result[key] = value.trim();
    }
  }
  return result.tone || result.never_change || result.adjustment ? result : undefined;
}
