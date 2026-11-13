/** LINK/legacy DISCOVER: navigation alternatives, never a grant of OAuth scopes. */
const suggestions=Object.freeze({
 facebook_pages:["Use the approved Facebook Page connection flow; direct posting requires Page permissions.","Use a campaign share URL manually if Page publishing is unavailable."],
 instagram:["Professional-account authorization and content-creation permission must both be verified.","Use a manual campaign link in your profile or post using the provider's own app."],
 youtube:["Use the approved Google/YouTube connection, with video upload scopes verified separately.","Share a campaign link in an authorized video description manually."],
 google:["Google identity does not automatically grant Drive, YouTube or payment scopes.","Authorize only the exact Google product and scopes required."],
 linkedin:["Check whether the provider approved the needed member publishing permission.","Use manual sharing through LinkedIn while API publishing is unavailable."],
 tiktok:["Video upload requires applicable provider review and creator authorization.","Use the provider's application for manual publishing when direct upload is unavailable."],
 x:["Confirm current API approval and the specific write permissions.","Share campaign updates manually through your account."],
 gofundme_pro:["Organization-level integration requires separately authorized administrator configuration.","Use the provider's official campaign tools while the integration is unavailable."],
 gofundme:["Consumer campaign links are separate from organization API rights.","Copy a public campaign URL manually using authorized sharing controls."],
});
export function providerConnectionGuide(providerId) {
 const steps=suggestions[providerId];
 return steps?{permission:steps[0],alternative:steps[1]}:{
  permission:"The provider's current authorization methods must be confirmed.",
  alternative:"Share a public campaign link manually only when permitted."
 };
}
