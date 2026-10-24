export function validateCampaign(campaign, publish = false) {
  if (!publish) return [];
  const missing = [];
  if (!campaign.title?.trim()) missing.push('title');
  if (!campaign.summary?.trim()) missing.push('summary');
  if (!campaign.story?.trim()) missing.push('story');
  if (!Number.isFinite(Number(campaign.goal_amount)) || Number(campaign.goal_amount) <= 0) missing.push('a goal greater than zero');
  return missing;
}
export function publicStatus(status) { return status === 'active' ? 'Published' : 'Draft'; }
