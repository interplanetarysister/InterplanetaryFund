// Deterministic, free prepublication editorial audit.
// Advisories never rewrite a beneficiary's claims or expose campaign text to external agents.
export const MIN_PUBLICATION_STORY_CHARACTERS = 3500;
const length = value => Array.from(String(value ?? "").trim()).length;
const clean = value => String(value ?? "").trim();
const norm = value => clean(value).toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, " ").replace(/\s+/g, " ").trim();

export function reviewCampaignPublication(form = {}) {
  const title = clean(form.title), summary = clean(form.summary), story = clean(form.story);
  const storyCharacters = length(story);
  const remainingCharacters = Math.max(0, MIN_PUBLICATION_STORY_CHARACTERS - storyCharacters);
  const blockers = remainingCharacters > 0
    ? [`A full-length story needs at least ${MIN_PUBLICATION_STORY_CHARACTERS.toLocaleString("en-US")} characters; add ${remainingCharacters.toLocaleString("en-US")} more.`]
    : [];
  const findings = [];
  const add = (id, agent, title, advice) => {
    if (!findings.some(item => item.id === id)) findings.push({id, agent, title, advice});
  };
  if (story && !/[.!?…]["'’”)]?\s*$/u.test(story))
    add("story_terminal_punctuation", "story", "Finish the story with punctuation",
      "Review the final sentence and add a suitable full stop, question mark, or exclamation mark.");
  if (/([!?.,])\1{2,}/u.test(story))
    add("excess_punctuation", "story", "Review repeated punctuation",
      "Replace excessive runs of punctuation with intentional sentence boundaries.");
  if (/[\p{L}\p{N}][ \t]{3,}[\p{L}\p{N}]/u.test(story))
    add("multiple_spaces", "story", "Normalize spacing",
      "Remove unintended repeated spaces without changing the underlying facts.");
  const paragraphs = story.split(/\n\s*\n/u).map(p=>p.trim()).filter(Boolean);
  if (paragraphs.some(p => p.length > 950 && !/[.!?…]/u.test(p)))
    add("run_on_paragraph", "story", "Break up run-on paragraphs",
      "Review long passages without sentence boundaries; add punctuation and paragraphs for readability.");
  const sentences = story.split(/(?<=[.!?…])\s+|\n+/u).map(norm).filter(s=>s.length>=35);
  const counts = new Map();
  for (const item of sentences) counts.set(item, (counts.get(item)||0)+1);
  if ([...counts.values()].some(n=>n>=2))
    add("repeated_sentences", "polaris", "Remove repeated story passages",
      "Identify repeated sentences and remove only genuine duplication; preserve necessary details.");
  if (norm(summary).length>=45 && norm(story).includes(norm(summary)))
    add("summary_repeated", "polaris", "Avoid repeating the full summary",
      "The short description appears verbatim in the story; make the story add new supporting details.");
  if (norm(title).length>=18 && norm(summary).includes(norm(title)) && norm(story).includes(norm(title)))
    add("title_repetition", "echo", "Reduce headline repetition",
      "Check whether the title is repeated unnecessarily across the summary and story.");
  if (storyCharacters < MIN_PUBLICATION_STORY_CHARACTERS)
    add("story_depth", "story", "Develop the full-length story",
      "Explain the verified situation, budget, timeline, who benefits, and how supporters will be updated. Do not invent facts.");
  if (!/(?:\$|\bbudget\b|\bexpenses?\b|\bcosts?\b|\bfunds?\s+will\b)/iu.test(story))
    add("budget_clarity", "orbit", "Clarify intended use of funds",
      "Explain the budget in plain language without promising unverified funding outcomes.");
  if (!/(?:\bweek\b|\bmonth\b|\bdeadline\b|\btimeline\b|\bupdate\b|\bprogress\b)/iu.test(story))
    add("timeline_updates", "nexus", "Clarify timing and progress updates",
      "Describe realistic milestones and supporter updates, where known.");
  return {
    storyCharacters, minimumCharacters: MIN_PUBLICATION_STORY_CHARACTERS,
    remainingCharacters, blockers, findings: findings.slice(0,12),
    reviewReady: blockers.length === 0,
  };
}

// Safe cross-agent packet deliberately excludes raw personal story text.
export function publicationAgentTasks(form) {
  return reviewCampaignPublication(form).findings.map(({id,agent,title,advice})=>({
    finding_id:id, agent, title, advice,
  }));
}
