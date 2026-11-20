/**
 * Campaign starter templates and visual styles.
 *
 * These templates shape the *creation experience* — the category artwork, the
 * writing outline and the live preview. They never invent donations, totals,
 * supporters, testimonials or achievements, and they never alter the campaign
 * ledger, owner authorization or financial calculations. A published campaign
 * keeps the canonical iFund campaign record and its verified data.
 *
 * Category ids are exactly the ids allowed by the campaign schema; expanding
 * them requires a reviewed additive migration, not a UI-only change.
 */

export const TEMPLATE_STYLES = Object.freeze([
  {
    id: "clean",
    name: "Clean & professional",
    short: "Calm, credible, easy to read.",
    description:
      "A restrained layout with clear sections and generous spacing. Good when the cause should speak for itself.",
    surface: "from-slate-50 via-white to-cyan-50",
    accent: "text-cyan-700",
    accentBg: "bg-cyan-600",
    ring: "border-cyan-200",
    recommendedFor: ["medical", "education", "business", "other"],
  },
  {
    id: "warm",
    name: "Warm & personal",
    short: "Close, human and heartfelt.",
    description:
      "Softer surfaces and an intimate reading rhythm. Good for family, memorial and personal needs.",
    surface: "from-rose-50 via-white to-amber-50",
    accent: "text-rose-700",
    accentBg: "bg-rose-600",
    ring: "border-rose-200",
    recommendedFor: ["emergency", "memorial", "medical", "animals"],
  },
  {
    id: "cosmic",
    name: "Cosmic geometry",
    short: "The iFund signature look.",
    description:
      "Deep space surfaces, thin fluorescent linework and a sense of possibility. Good for bold ideas and new projects.",
    surface: "from-slate-900 via-slate-950 to-indigo-950",
    accent: "text-cyan-300",
    accentBg: "bg-cyan-400",
    ring: "border-cyan-400/40",
    recommendedFor: ["creative", "environment", "business", "other"],
  },
  {
    id: "bold",
    name: "Bold & inspirational",
    short: "Big type, clear momentum.",
    description:
      "Strong headings and a confident first screen. Good for urgent needs and ambitious goals.",
    surface: "from-orange-50 via-white to-rose-50",
    accent: "text-orange-700",
    accentBg: "bg-orange-600",
    ring: "border-orange-200",
    recommendedFor: ["emergency", "disaster_relief", "community", "education"],
  },
  {
    id: "editorial",
    name: "Editorial story",
    short: "Magazine-like and narrative.",
    description:
      "Serif display type and a story-first flow. Good when the journey matters as much as the goal.",
    surface: "from-stone-50 via-white to-emerald-50",
    accent: "text-emerald-800",
    accentBg: "bg-emerald-700",
    ring: "border-emerald-200",
    recommendedFor: ["memorial", "creative", "community", "education"],
  },
  {
    id: "community",
    name: "Community impact",
    short: "Collective and forward-looking.",
    description:
      "A shared-progress layout that emphasizes the people and places involved. Good for neighbourhood and group causes.",
    surface: "from-teal-50 via-white to-blue-50",
    accent: "text-teal-800",
    accentBg: "bg-teal-700",
    ring: "border-teal-200",
    recommendedFor: ["community", "environment", "disaster_relief", "animals"],
  },
]);

export const TEMPLATE_CATEGORIES = Object.freeze([
  {
    id: "emergency",
    label: "Emergency assistance",
    icon: "life-buoy",
    blurb: "Urgent help with housing, food, safety or an unexpected crisis.",
    style: "bold",
    gradient: "from-orange-500/20 via-rose-500/10 to-amber-400/20",
  },
  {
    id: "medical",
    label: "Medical & wellness",
    icon: "heart-pulse",
    blurb: "Treatment, recovery, caregiving and health-related costs.",
    style: "warm",
    gradient: "from-rose-500/20 via-pink-400/10 to-cyan-400/20",
  },
  {
    id: "community",
    label: "Community projects",
    icon: "users",
    blurb: "Local spaces, shared resources and neighbourhood goals.",
    style: "community",
    gradient: "from-teal-500/20 via-cyan-400/10 to-blue-500/20",
  },
  {
    id: "education",
    label: "Education",
    icon: "graduation-cap",
    blurb: "Tuition, training, classroom needs and learning opportunities.",
    style: "clean",
    gradient: "from-cyan-500/20 via-blue-400/10 to-indigo-400/20",
  },
  {
    id: "animals",
    label: "Animals & wildlife",
    icon: "paw-print",
    blurb: "Rescue, veterinary care and habitat protection.",
    style: "warm",
    gradient: "from-amber-500/20 via-lime-400/10 to-emerald-400/20",
  },
  {
    id: "business",
    label: "Small business",
    icon: "store",
    blurb: "Equipment, space, inventory and a first or next step.",
    style: "cosmic",
    gradient: "from-indigo-500/20 via-violet-400/10 to-cyan-400/20",
  },
  {
    id: "creative",
    label: "Creative projects",
    icon: "palette",
    blurb: "Music, film, art, publishing and independent craft.",
    style: "editorial",
    gradient: "from-fuchsia-500/20 via-violet-400/10 to-cyan-400/20",
  },
  {
    id: "environment",
    label: "Planet & environment",
    icon: "leaf",
    blurb: "Conservation, restoration and climate action.",
    style: "community",
    gradient: "from-emerald-500/20 via-teal-400/10 to-cyan-400/20",
  },
  {
    id: "disaster_relief",
    label: "Disaster relief",
    icon: "shield",
    blurb: "Immediate response and recovery after a disaster.",
    style: "bold",
    gradient: "from-red-500/20 via-orange-400/10 to-amber-400/20",
  },
  {
    id: "memorial",
    label: "Memorial",
    icon: "flower",
    blurb: "Honour a life and support the people who loved them.",
    style: "editorial",
    gradient: "from-slate-500/20 via-stone-400/10 to-emerald-400/20",
  },
  {
    id: "other",
    label: "Something else",
    icon: "sparkles",
    blurb: "A personal goal, an idea or a need that does not fit a box.",
    style: "cosmic",
    gradient: "from-cyan-500/20 via-blue-400/10 to-violet-400/20",
  },
]);

export const TEMPLATE_SECTIONS = Object.freeze([
  { id: "story", label: "Your story" },
  { id: "goal", label: "Funding goal" },
  { id: "progress", label: "Progress" },
  { id: "gallery", label: "Image gallery" },
  { id: "updates", label: "Updates" },
  { id: "spending", label: "Spending explanation" },
  { id: "milestones", label: "Milestones" },
  { id: "supporters", label: "Supporter activity" },
  { id: "sharing", label: "Sharing" },
  { id: "creator", label: "Creator information" },
]);

const STYLE_MAP = new Map(TEMPLATE_STYLES.map((style) => [style.id, style]));
const CATEGORY_MAP = new Map(TEMPLATE_CATEGORIES.map((category) => [category.id, category]));

export function isTemplateStyle(id) {
  return STYLE_MAP.has(id);
}

export function isTemplateCategory(id) {
  return CATEGORY_MAP.has(id);
}

export function templateStyle(id) {
  return STYLE_MAP.get(id) || STYLE_MAP.get("clean");
}

export function templateCategory(id) {
  return CATEGORY_MAP.get(id) || CATEGORY_MAP.get("other");
}

/** Styles that suit a category, best match first. */
export function recommendedTemplates(categoryId) {
  const category = templateCategory(categoryId);
  return [...TEMPLATE_STYLES].sort((a, b) => {
    const score = (style) =>
      (style.id === category.style ? 2 : 0) +
      (style.recommendedFor.includes(category.id) ? 1 : 0);
    return score(b) - score(a);
  });
}

/**
 * A writing outline the owner can use or ignore. It contains prompts rather
 * than invented facts, so it never adds a claim the owner did not make.
 */
export function templateOutline(categoryId) {
  const category = templateCategory(categoryId);
  return [
    { heading: "What this is for", prompt: `Describe the ${category.label.toLowerCase()} need or goal in your own words.` },
    { heading: "Why it matters now", prompt: "Share what has changed, what you have already tried, and why support would help at this moment." },
    { heading: "What the money will do", prompt: "List the specific costs you expect and what happens if the goal is reached." },
    { heading: "Who is involved", prompt: "Introduce yourself or the people and group this supports. Only include information they have agreed to share." },
    { heading: "How supporters can help", prompt: "Explain what a contribution, a share or a connection would make possible." },
  ];
}

export function outlineToStory(categoryId) {
  return templateOutline(categoryId)
    .map((section) => `${section.heading}\n${section.prompt}`)
    .join("\n\n");
}

/**
 * Apply a template link to a campaign form without overwriting anything the
 * owner already typed. Only an empty/new form receives the outline.
 */
export function applyTemplateToForm(form, { category, template, withOutline = false } = {}) {
  const next = { ...form };
  if (isTemplateCategory(category)) next.category = category;
  if (withOutline && !String(next.story || "").trim()) {
    next.story = outlineToStory(next.category);
  }
  return { form: next, style: templateStyle(template).id };
}
