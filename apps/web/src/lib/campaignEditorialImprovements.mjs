/**
 * Free deterministic campaign-wide editorial suggestions.
 * Recommendations are reversible; organizer explicitly approves every edit.
 * Never invent facts, rewrite beneficiary claims or post to an external service.
 */
const text = value => typeof value === "string" ? value : String(value ?? "");
const normalize = value => text(value).toLocaleLowerCase("en").replace(/[^\p{L}\p{N}\s]/gu, " ").replace(/\s+/gu, " ").trim();
const sentenceParts = value => text(value).match(/[^.!?…\n]+(?:[.!?…]+(?=\s|$)|(?=\n|$))/gu) || [];
function formatText(value, terminal = false) {
  let next = text(value).replace(/[ \t]{3,}/gu, "  ").replace(/([!?.,])\1{2,}/gu, "$1");
  const trimmed = next.trimEnd();
  if (terminal && trimmed && !/[.!?…][\"'’”)]?$/u.test(trimmed)) next = trimmed + "." + next.slice(trimmed.length);
  return next;
}
function repeatedLines(value) {
  const list = sentenceParts(value).map(s => normalize(s)).filter(s => s.length >= 45);
  const seen = new Set();
  return list.filter(s => { if (seen.has(s)) return true; seen.add(s); return false; });
}
export function reviewCampaignWideEditorial(form = {}) {
  const title = text(form.title), summary = text(form.summary), story = text(form.story);
  const issues = [];
  const add = (id, field, agent, title, advice) => { if (!issues.some(i => i.id === id)) issues.push({ id, field, agent, title, advice }); };
  if (title !== formatText(title) || /\s{3,}/u.test(title)) add("title_spacing", "title", "echo", "Polish the campaign title", "Remove unintended extra spacing and punctuation.");
  if (summary && (summary !== formatText(summary, true))) add("summary_punctuation", "summary", "echo", "Polish the short description", "Review sentence-ending punctuation and unintended spacing.");
  if (story && (story !== formatText(story, true))) add("story_punctuation", "story", "story", "Polish story punctuation", "Review punctuation and spacing without modifying the facts.");
  if (repeatedLines(summary).length > 0) add("summary_redundancy", "summary", "polaris", "Shorten repeated summary sentences", "Review repeated complete sentences in the short description.");
  if (repeatedLines(story).length > 0) add("story_redundancy", "story", "polaris", "Remove repeated story sentences", "Consider removing exact duplicated sentences; retain important context.");
  const normSummary = normalize(summary), normStory = normalize(story), normTitle = normalize(title);
  if (normSummary.length >= 45 && normStory.includes(normSummary)) add("cross_field_summary", "story", "polaris", "Avoid repeating the short description", "Make the full story add useful detail instead of duplicating its entire summary.");
  if (normTitle.length >= 18 && normSummary.includes(normTitle) && normStory.includes(normTitle)) add("cross_field_title", "summary", "echo", "Review repeated headline wording", "The headline appears in multiple fields. Keep purposeful repetition only.");
  return issues;
}
export function proposeCampaignWidePunctuation(form = {}) {
  const before = { title:text(form.title), summary:text(form.summary), story:text(form.story) };
  const after = {
    title: formatText(before.title),
    summary: formatText(before.summary, true),
    story: formatText(before.story, true),
  };
  const changed = Object.keys(after).filter(k => before[k] !== after[k]);
  return { before, after, changed, hasChanges:changed.length > 0 };
}
/**
 * Repetition review never deletes whole campaign fields or modifies title.
 * Exact duplicate LONG sentences are removed from within a field only.
 * Cross-field duplicates are warnings: automatically deleting these can
 * destroy the minimum story length and remove valuable context.
 */
export function proposeCampaignWideRedundancy(form = {}) {
  const before = { title:text(form.title), summary:text(form.summary), story:text(form.story) };
  const after = {...before};
  const removed = {};
  for (const key of ["summary","story"]) {
    const parts = text(before[key]).split(/(?<=[.!?…])\s+/u);
    const seen = new Set();
    let count = 0;
    const kept = parts.filter(p => {
      const n = normalize(p);
      if (n.length < 50) return true;
      if (seen.has(n)) {count++; return false;}
      seen.add(n);return true;
    });
    if (count) { after[key] = kept.join(" "); removed[key] = count; }
  }
  return {before,after,removed,changed:Object.keys(removed),hasChanges:Object.keys(removed).length>0};
}
