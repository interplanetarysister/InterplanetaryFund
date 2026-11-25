/** An editorial checklist, not a statistical prediction or model inference. */
export function evaluatePostDraft(value) {
  const text = String(value || "").trim();
  if (!text) return { score: null, items: [] };
  const words = text.split(/\s+/).filter(Boolean);
  const items = [
    { label: "Clear action or next step", pass: /\b(share|read|visit|join|help|support|volunteer|learn|donate|reply|contact)\b/i.test(text) },
    { label: "Readable length for a short post", pass: words.length >= 12 && words.length <= 130 },
    { label: "Specific context beyond a generic appeal", pass: /\b(because|to help|so that|for our|for the|funds? (?:will|go|toward)|need|goal|project)\b/i.test(text) },
    { label: "Sentence structure and accessible punctuation", pass: /[.!?]/.test(text) && !/([!?])\1{2,}/.test(text) },
    { label: "No unsupported urgency or guaranteed outcome phrasing", pass: !/\b(guaranteed?|100% success|everyone must|last chance|miracle cure)\b/i.test(text) },
  ];
  return { score: items.filter(item => item.pass).length * 20, items };
}

export function summarizeAudienceFeedback(ratings) {
  const valid = ratings.filter(n => Number.isInteger(n) && n >= 1 && n <= 5);
  return { count: valid.length, mean: valid.length ? valid.reduce((a, b) => a + b, 0) / valid.length : null };
}
