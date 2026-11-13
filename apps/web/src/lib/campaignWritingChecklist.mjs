// Zero-cost, local-only Story briefing aid. Never sends or stores input.
const wordCount = text => (String(text || "").trim().match(/\b[\p{L}\p{N}][\p{L}\p{N}'’-]*\b/gu) || []).length;
export function analyzeStoryBrief(input) {
  const text = String(input ?? "").slice(0, 4000);
  const words = wordCount(text);
  const checks = [
    { id: "need", label: "Explain the need", prompt: "Describe the specific problem and the help required.", suggested: words < 35 },
    { id: "amount", label: "Explain the budget", prompt: "Include a breakdown of what funds will pay for, if known.", suggested: !/(?:\$|usd\s*|costs?\s+|budget|expenses?|funds?\s+will)/i.test(text) },
    { id: "time", label: "Explain the timeframe", prompt: "Mention any confirmed deadline or expected timeline; avoid inventing urgency.", suggested: !/(?:\b(?:today|tomorrow|week|month|year|before|by|deadline|timeline|date|urgent)\b|\b20\d\d\b)/i.test(text) },
    { id: "outcome", label: "Explain the impact", prompt: "Describe who benefits and what will change if the goal is reached.", suggested: !/(?:\b(?:help|support|benefit|impact|improve|allow|enable|provide|receive)\b)/i.test(text) },
    { id: "trust", label: "Plan an update", prompt: "Consider how supporters will receive verified progress updates.", suggested: !/(?:\b(?:updates?|progress|receipts?|reporting|transparency)\b)/i.test(text) },
  ];
  // These patterns are warnings, not a complete privacy scanner.
  const sensitive = /\b\d{3}-\d{2}-\d{4}\b|\b(?:password|passcode|one[- ]time code|private key|api[- ]?key|access[- ]?token|secret[- ]?key)\s*[:=]/i.test(text)
    || /\b(?:\d[ -]?){15}\d\b/.test(text);
  return { words, checks, sensitive, isLongEnough: text.trim().length >= 12 };
}
