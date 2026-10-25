// Builds varied, personal cover-image prompts so regenerating produces clearly
// different results instead of near-identical images.

const STYLES = [
  "golden-hour natural light, shallow depth of field, candid documentary feel",
  "soft overcast daylight, muted earthy palette, intimate and quiet mood",
  "bright midday sun, rich saturated colors, hopeful and energetic",
  "warm indoor lamplight, cozy and personal, close-up perspective",
  "dramatic low-key lighting with one warm highlight, cinematic and emotional",
  "bright airy morning light, pastel tones, gentle and uplifting",
  "moody blue-hour twilight, cool tones with a single warm focal point",
  "wide environmental landscape, human scale, vast and hopeful",
  "tight detail shot of hands or meaningful objects, textured and tactile",
];

const SCENES = {
  medical: "a quiet moment of care and recovery in a warm hospital room",
  emergency: "a community coming together after a sudden hardship",
  education: "a student learning with focus and determination",
  community: "neighbors gathered outdoors in solidarity",
  animals: "a beloved animal in a calm, caring setting",
  business: "a small business owner at work, proud and hopeful",
  memorial: "a gentle, reverent still life honoring a loved one",
  disaster_relief: "volunteers delivering supplies to a recovering neighborhood",
  creative: "an artist mid-project, surrounded by their work",
  other: "a person at a meaningful turning point in their life",
};

export function buildCoverPrompt({ title, category, regenCount = 0 }) {
  const style = STYLES[regenCount % STYLES.length];
  const scene = SCENES[category] || SCENES.other;
  return `Photorealistic cover photo for a ${category} fundraising campaign titled "${title}". ${scene}. Shot with ${style}. Composition variation #${regenCount + 1}. No text, no watermark, no logos.`;
}