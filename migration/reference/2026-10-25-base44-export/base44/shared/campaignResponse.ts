// Explicit API allowlist for Campaign records read with service-role access.
// Private import correlation fields and any future server-only fields fail closed
// because only named fields can cross a function response boundary.
const CAMPAIGN_RESPONSE_FIELDS = [
  'id', 'created_by_id', 'created_date', 'updated_date',
  'title', 'summary', 'story', 'category', 'goal_amount', 'raised_amount',
  'donor_count', 'status', 'cover_image_url', 'cover_image_is_ai', 'end_date', 'location',
  'location_lat', 'location_lng', 'cashapp_tag',
  'distribution_donation_connection_id', 'accept_crypto_donations',
  'ai_profile', 'story_versions', 'outreach_enabled', 'outreach_paused',
  'draft_step', 'outreach_last_run_at', 'outreach_last_attempt_at',
  'outreach_last_error', 'social_last_generated_at',
  'social_last_generation_attempt_at',
];

/** @param {Record<string, unknown> | null | undefined} campaign */
export function campaignForResponse(campaign) {
  if (!campaign) return campaign;
  return Object.fromEntries(
    CAMPAIGN_RESPONSE_FIELDS
      .filter((field) => Object.prototype.hasOwnProperty.call(campaign, field))
      .map((field) => [field, campaign[field]]),
  );
}
