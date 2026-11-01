# Campaign image rendering + save-at-any-step draft repair

Date: 2026-10-08
Target: Interplanetary Fund Base44 project source

## Repairs

### Generated images

- Campaign cover generation now calls the authenticated backend `generateCampaignCover`,
  validates the returned URL, preloads and decodes the image in the browser, and
  updates the campaign only after the new file is confirmed loadable.
- Image generation failure never silently replaces the chosen cover. It displays
  an actionable error; a separate, credit-free **Use free branded cover** option
  is available and clearly labeled as an alternative.
- Shared Image component now gives transformed Wix/Base44 photos real intrinsic
  height instead of absolutely positioning them inside undimensioned wrappers.
  If a CDN transform fails, it retries the underlying original asset before
  displaying a fallback. This affects campaign covers, card images, social posts
  and other platform surfaces that share the component.
- Uploaded-photo IFund conversion also preloads and decodes before updating.
- AI official social post creation refuses missing/malformed generated image
  responses instead of saving a broken media URL.
- Provider availability, image generation quality and final published-browser
  rendering require real interactive tests after deployment. Source tests do not
  establish third-party service availability.

### Save draft at ANY wizard step

- Campaign schema accepts an empty title and zero goal for private drafts; active
  campaigns still require title, goal and story. Existing owner-only draft RLS
  remains unchanged.
- Backend permits and preserves `ai_profile`, `story_versions`, and
  `draft_step` in addition to the visible campaign fields.
- **Save draft** is available on all four creation steps. A first save creates
  the draft and keeps the builder on the same step.
- Reopening a draft restores the step reached, story/version history, AI choices,
  campaign fields and optional image.
- Dashboard draft cards link back to the editor and show **Untitled draft** when
  no title has been entered; no fake fundraising totals are shown.
- Protocol enforcement no longer requests completed content or launches agents
  on an intentionally unfinished private draft.
- The creator can later complete the required fields and publish normally.
  Drafts stay private under the existing Campaign RLS.

## Verification

- Mock handler regression tests cover creating totally blank drafts, updating a
  middle-step draft, rejecting incomplete public launch, owner authorization,
  and missing authentication.
- Generated-media helpers are tested for valid/invalid URLs, successful browser
  image loads and failures; backend generator mock tests cover authentication,
  missing assets, malformed responses, exceptions and multiple return shapes.
- Source regressions assert fixed image layout and safe untransformed retry.
- Local TypeScript, ESLint, Vite build, production-build-output contract and
  existing server-authoritative mutation checks passed.

## Deployment checks

1. Publish current `main` in Base44.
2. Open Create Campaign; from step 1, click Save Draft with no title or goal,
   then verify it appears privately in Dashboard > Drafts.
3. Return to the draft, enter some fields on step 2 or 3, save and reopen. The
   active wizard step, story history, AI selections and image must persist.
4. Generate an actual AI cover. Confirm the result is visible immediately and
   after refreshing, saving and reopening the campaign; if provider unavailable
   confirm failure notice and old cover intact.
5. Try a Base44/Wix-hosted uploaded image and a normal HTTPS media URL. Confirm
   full-size image and social post thumbnail occupy visible space on mobile.
6. Test the free branded graphic without image-generation credits.
7. Verify a fully completed campaign can publish, while blank drafts remain
   private and are not exposed in public search.


## Campaign supporter input simplification — 2026-10-22

One optional supporter question replaces donor-discovery notes, ideal donors, and interested organizations inputs in AIInstructionsStep. Legacy distinct answers combine into one visible editable value; any edit normalizes them into donor_discovery_notes and clears the superseded fields, including when the user clears the answer. Beneficiary and campaign purpose questions remain distinct. Outreach reads canonical notes with legacy fallback and researches beyond optional creator guesses. Campaign protocol no longer requires optional AI profile answers or generates reminders for them. Built-in help updated.

Reused existing React controls and profile/schema instead of adding a form library or provider; no dependency changes or paid generation calls. Targeted ESLint passed. Deterministic behavior checks passed for preservation, deduplication, clearing, and unrelated profile edits. No production workflow, AI request, or live publishing invoked. Published UI and live backend behavior remain unverified. Restore preceding checkpoint to roll back.


## Voice-guided Alexa+ simulation implementation — 2026-10-22

Owner request: complete a production-ready voice campaign simulation and define remaining demo blockers. Implemented in the existing CreateCampaign route, entered with /create?voice=1 or the Create by voice button; no duplicate campaign page or data store. New CampaignVoiceAssistant component and pure campaignVoiceCommands parser maintain the shared wizard form.

Behavior: deliberate tap-to-talk (never background wake-word listening), browser speech synthesis, visible bounded transcript, typed-command fallback, mute/stop/read controls, microphone-denial guidance, purpose and beneficiary capture, numeric goal capture, five generated title choices, title selection, factual story generation, campaign-context image generation with existing style/watermark policy, live visible campaign preview, and explicit private-draft save only. Successful saves require a returned canonical campaign ID. Save failure removes the prior saved badge and reports that no success was confirmed. No publish/payment/withdrawal commands. Existing draft answers are reused. Voice mode persists when the first save adds the draft ID. Concurrent voice commands are locked, and stale story results do not overwrite intervening title/story edits. Closing the assistant aborts listening and cancels speech.

Truth/privacy: prominently labeled Simulated Alexa+ experience; not an Amazon connection or Alexa voice. Browser recognition may send audio to its service; no IFund microphone recording storage. Transcript is component memory, not a persistent log. Real AI providers and canonical saving are used by production code; mocked tests never appear in production.

Verification completed: changed JS/JSX lint; pure command tests; existing seven campaign-cover endpoint cases; external gateway mock tests; production Vite build; headless Chromium at 390x844 exercised purpose, simulated recognition event, beneficiary, title choices/selection, story/art rendering, complete draft payload, correct returned-ID confirmation, failed-save honesty, speech-synthesis invocation, denied microphone, no JS errors and no horizontal overflow. Tests used mocked backend/provider/speech and do not prove actual microphone audio, audible voice quality, live AI, or live storage. Test command: node scripts/test-campaign-voice-browser.mjs (build artifact expected at /tmp/ifund-voice-build; build with node_modules/.bin/vite build --outDir /tmp/ifund-voice-build).

Image-save hardening: deferred native sharp import until watermark-required processing rather than loading it at function startup. Admin/paid saves and blank private drafts no longer need to load the optional processor. The reported live 500 has NOT been reproduced or confirmed resolved. Free-account native watermark operation still needs real-runtime verification.

Reuse discovery: evaluated https://github.com/JamesBrill/react-speech-recognition (MIT, React hook/API reference) and MDN SpeechRecognition/SpeechSynthesis documentation. Native browser APIs fit the small push-to-talk state machine without adding dependencies or paid speech providers. Recognition support varies by browser and may require network access. No library source copied and no new npm dependency added.

Production/demo blockers (not production-ready yet):
1. Publishing credentials: npx --no-install base44 whoami reported not logged in; no website deploy occurred. Reauthenticate the publishing CLI through the normal owner device-login flow, then publish the validated frontend. The temporary login probe timed out; do not reuse its old code. Connected editor access still saves/checkpoints source.
2. Cloudflare inference is prepared but not activated/deployed: existing live worker has no AI/rate-limit bindings; free allowance/billing-plan inspection is unavailable to the current OAuth connection (Billing Read 403). Verify free allowance and activate the documented AI route/limits and client endpoint, preserving current assets/bindings. No actual Cloudflare inference or paid generation was invoked here.
3. In a signed-in account, run actual titles -> story -> image -> private save -> reopen. Confirm server image processing and resolve any persistent 500 before recording.
4. Use a supported phone/desktop browser with mic permission; verify audible replies and recording captures both mic and app audio. Installed Android WebView recognition is not guaranteed; no new APK was built.
5. Demo script: help me raise $2,000 to repair our community garden -> local families -> show five titles -> choose the second title -> write my story -> create a picture -> read my campaign -> save as a draft -> reopen saved draft. Record an under-three-minute video showing actual responses/actions and the simulation disclosure.

Submission rules checked at https://amazonappdev2026.devpost.com/rules (Alexa+ alternate simulated-experience path) and https://paypalaihackathon.devpost.com/rules. This simulation alone does not fulfill PayPal sandbox requirements; separately verify central sandbox payments. Keep actual tools disclosed in required Amazon product feedback. Rollback: restore the checkpoint preceding voice work; existing standard wizard and canonical records remain intact.
