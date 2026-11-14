// Transparent editorial heuristics, not a prediction of donations or campaign success.
// Weights are product design choices, not empirical coefficients or a verified model.
export const READINESS_WEIGHTS = Object.freeze({
  title:15, summary:15, picture:15, story:25, purpose:15, category:5, sharing:10,
});
export function analyzeStoryStructure(value) {
  const paragraphs = String(value ?? "").trim().split(/\n\s*\n/u).map(p => p.trim()).filter(Boolean);
  const sentences = paragraphs.map(p => (p.match(/[^.!?…]+(?:[.!?…]+(?=\s|$)|$)/gu) || []).filter(s => /[\p{L}\p{N}]/u.test(s.trim())).length);
  return { paragraphs:paragraphs.length, sentences,
    valid: paragraphs.length >= 2 && paragraphs.length <= 3 &&
      sentences.every(n => n >= 3 && n <= 5),
  };
}
const letters = value => String(value ?? "").trim();
const words = value => letters(value).split(/\s+/u).filter(Boolean).length;
const clamp = (v,max) => Math.max(0, Math.min(max, Math.round(v)));
const item = (key,label,earned,tip,field) => ({
  key,label,max:READINESS_WEIGHTS[key],earned:clamp(earned, READINESS_WEIGHTS[key]),tip,field,
});
export function calculateCampaignReadiness(form = {}, { sharingPlan = false } = {}) {
  const title=letters(form.title), summary=letters(form.summary), story=letters(form.story);
  const structure=analyzeStoryStructure(story);
  const hasGoal=Number(form.goal_amount)>0 && Number.isFinite(Number(form.goal_amount));
  const hasImage=/^https?:\/\/[^\s]+$/i.test(letters(form.cover_image_url));
  const budget=/(?:\$|\bbudget\b|\bexpenses?\b|\bcosts?\b|\bfunds?\b)/iu.test(story);
  const updates=/\b(?:update|timeline|deadline|progress|milestone|week|month)\b/iu.test(story);
  const why=/(?:\b(?:because|need|help|support|purpose|impact|benefit|will allow)\b)/iu.test(story+" "+summary);
  const rows=[
    item("title","Title",!title?0:title.length>=24&&title.length<=100?15:title.length>=12?10:5,
      "Use a clear, specific title that explains the cause.", "campaign-title"),
    item("summary","Short description",!summary?0:words(summary)>=25&&words(summary)<=95?15:words(summary)>=12?10:5,
      "Summarize who needs help, why, and the intended impact in plain language.", "campaign-summary"),
    item("picture","Cover image",hasImage?15:0,
      "Add a relevant, authorized image. Its authenticity and permission must be checked by you.", "campaign-cover"),
    item("story","Full story",!story?0:clamp(
      (structure.valid?12:structure.paragraphs>=2?6:2)+
      (story.length>=3500?8:story.length>=900?5:story.length>=300?2:0)+
      (/[.!?…]\s*$/u.test(story)?5:0),25),
      "Write 2–3 paragraphs with 3–5 sentences each; include the real situation, needs and next steps.", "campaign-story"),
    item("purpose","Purpose and plan",(hasGoal?6:0)+(why?3:0)+(budget?3:0)+(updates?3:0),
      "Set a realistic goal and explain fund use, beneficiaries and expected updates; check claims yourself.", "campaign-goal"),
    item("category","Category",form.category&&form.category!=="other"&&form.category!=="community"?5:form.category?3:0,
      "Choose the most accurate category, not the one you think will score higher.", "campaign-category"),
    item("sharing","Sharing plan",sharingPlan?10:0,
      "Decide how you will share the campaign with people who have agreed to hear from you.", "campaign-sharing-plan"),
  ];
  return { total:rows.reduce((n,row)=>n+row.earned,0), rows, structure,
    tips:rows.filter(row=>row.earned<row.max).sort((a,b)=>(b.max-b.earned)-(a.max-a.earned)),
    disclosure:"An editorial completeness score, not a statistically validated chance of fundraising success. The score cannot verify claims, permission to use photos, or beneficiary identity." };
}
