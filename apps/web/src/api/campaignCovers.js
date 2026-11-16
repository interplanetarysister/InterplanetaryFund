// Compatibility entrypoint for the image studio. All new campaign cover bytes
// use the canonical authenticated R2 API; existing image URLs are preserved.
export { uploadCampaignCover, validateCoverFile, isVerifiedCoverOwner, MAX_COVER_BYTES } from './campaignMedia.js';
