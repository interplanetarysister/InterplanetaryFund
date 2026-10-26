# IFund image and campaign-copy verification — October 8, 2026

## Source changes

The signed-in user image-editing backend accepts two public, app-owned media URL patterns:
- `https://media.base44.com/images/public/<IFund-app-id>/...`
- `https://base44.app/api/apps/<IFund-app-id>/files/mp/public/...`

Both patterns have real IFund media in use. Any unrelated external host or foreign app ID is rejected.

The backend sends the actual original photo as `images:[{image_url}]` to the authorized image-edit API when configured; otherwise it returns a clear credit-free treatment mode. Client-side compositing retains the original photo as the full-opacity base, overlays IFund styling, embeds the logo and domain, then saves a new output. Original uploads remain unchanged.

The Reown wallet's icon has been aligned with `/icon-192.jpg`, derived from the same verified planet logo used elsewhere. Campaign embed HTML, one-click/manual clipboard fallback, and copy-ready update creation have regression tests.

## Verification completed

- Public `https://interplanetaryfund.com/` and `https://interplanetaryfund.base44.app/` responded HTTP 200.
- The actual logo file returned HTTP 200 on the live domain; the reference image from Base44 (Copy) is tracked by checksum in image-style regression tests.
- Base44 public media returned HTTP 200, image type and permissive CORS.
- A real existing `base44.app/api/apps/.../files/mp/public/...` image returned HTTP 200, image/png and permissive CORS.
- All image-style, compositing, campaign-copy, draft, cover-generation and action-navigation regression tests pass in the source environment.
- Local frontend build, TypeScript and lint are part of the release gate.
- No live paid image-generation operation has been initiated.

## Remaining deployment check

Published site currently serves `/assets/index-B3viOyYY.js` while the freshly built local main produced a different entry bundle (`index-BuZ9dZvN.js` before the latest fixes); the local compiled bundle was not present on the public host. This indicates a build/deployment mismatch; compare the published build after publishing the latest main. Bundle fingerprints can also vary by environment, so the final proof is a real authenticated browser run.

After publishing main:
1. Open campaign creation, upload a genuine photo, click **Generate IFund-style improvement**, and confirm the actual source photo remains recognizable.
2. Confirm the watermark planet and `interplanetaryfund.com` are faintly present in the newly saved file and not only an HTML overlay.
3. Confirm the result displays after refresh and from a public campaign page.
4. Try the credit-free **Generate IFund image** in the social composer.
5. Paste the campaign iframe HTML into a separate site and open the link.
6. Generate a campaign update, copy its text and save an incomplete draft.
7. Revoke/omit image-editing API credentials and verify the credit-free fallback still works.

A real third-party image-edit request may incur provider charges; test only with authorized budget and billing controls.


## Automatic watermark UX repair — 2026-10-22

Owner clarification: uploads and generated media must apply watermark policy automatically; no separate Use IFund version step. Removed the restyle/version chooser from MediaUpload and PostComposer. Generate Image continues creating and selecting the processed result through brandAndUploadGeneratedImage; uploads continue through uploadUserImage. Free photo uploads/generation receive burned-in branding automatically; current active-paid/admin entitlement skips branding. Prevent social publishing while upload/generation is pending. Updated built-in campaign help.

Reuse decision: retained existing browser Canvas branding and server sharp pipeline (https://github.com/lovell/sharp; Apache-2.0 LICENSE inspected), without adding dependencies, provider services, generation calls, or metered builds. No new library was needed for removing the redundant controls.

Verification: targeted ESLint passed for both changed components and workflowHelpGuides. Deterministic Vite build emitted /tmp/ifund-watermark-build/index.html but command exceeded its 20-second transport timeout; final build exit unverified. Confirmed removed chooser symbols no longer occur in either component. No real AI generation or upload request was executed.

Remaining: live publishing and authenticated browser interaction have not been verified. Video/non-image upload bypass remains; no claim of universal media watermarking. Automatic replacement of previously burned-in watermarks after an account upgrades is not implemented: clean originals and server-verified asset lifecycle are needed. The campaign launch 500 remains unconfirmed; image-policy errors are a suspect, not an established root cause. Rollback: restore the preceding Base44 checkpoint/source revision for these component/help changes.


## Automatic styling correction and extended art criteria — 2026-10-22

Restored source-preserving IFund photo treatment directly inside uploadUserImage before entitlement-based watermark compositing. Both free and paid users retain the style treatment; only the watermark is skipped for current paid/admin entitlement. No separate restyle or version button is required. Added futuristic-mystical-nature descriptors to buildCoverPrompt and canonical IFUND_SIGNATURE_STYLE / IFUND_PHOTO_EDIT_STYLE, plus subtle botanical/aurora border accents to the local treatment. Original identities and factual composition remain preserved.

Confirmed runtime source boundary: campaign image generation invokes Base44 Core.GenerateImage in generateCampaignCover; text suggestions use Core.InvokeLLM through secureLLM.js. These campaign generation flows are NOT externalized from Base44. renderInterplanetaryPhoto contains a conditional direct OpenAI edit call, hosted inside a Base44 function; configured-key presence and real provider operation were not inspected or tested. It is not part of the automatic credit-free upload treatment. No metered AI calls were made.

Validation: changed JavaScript ESLint and existing source-photo canvas test passed. Cover prompt variation assertions confirm the extended descriptor and original signature are present across 12 variations. Actual generated output and published deployment remain unverified. Previously burned-in watermark removal on upgrade and video processing remain unresolved.
