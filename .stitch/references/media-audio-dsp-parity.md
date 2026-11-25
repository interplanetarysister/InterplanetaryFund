# iFund Stitch Media/DSP consolidation — verified source mapping
Date: 2026-11-25. Development branch only; no production or provider acceptance implied.

## Actual Stitch source inspected
Original user library archive `stitch_interplanetary_fund_checkout_system (2).zip`, including these editable design references:
- `mobile_audio_studio_preset_library_open/code.html`
- `mobile_audio_studio_simplified_creator_controls/code.html`
- `mobile_creative_studio_3_stem_audio_dsp_console/code.html`
- `creative_studio_3_stem_audio_dsp_console_campaigns_1/code.html`
- `unified_creative_studio_video_safe_zone_3_stem_audio_dsp_console/code.html`
- `pending_approvals_with_interactive_audio_scrubbing_a_b_telemetry/code.html`
- `orbit_shorts_shorts_with_pink_noise_binaural_synthesizer/code.html`
- `pending_approvals_with_custom_frequency_preset_slider/code.html`

The archive is a UX/prototype source, **not** evidence that the screenshot's 99.8% sync, 98% attention, 24-bit float, 14 audio effects, official platform verification, audio masters, LUFS reading, retinal/biometric data, or AI stem separation have been measured or implemented. The production implementation must not display fabricated values.

## Consolidated existing route
- `/communications?tab=media&tool=audio` — layered Audio Editor (no new top-level audio route)
- `/communications?tab=media&tool=optimization` — original/AI media pre-post optimization, individual platform variants, clip cue and safe-area previews
- `/communications?tab=media&tool=artwork` — AI image generation, approved styles
- `/communications?tab=audience` — observed audience reactions only; never conflate with uncalibrated predicted metrics

## Source-to-code parity
| Stitch reference feature | Development state | Implementation / boundary |
|---|---|---|
| 3 independent stems: voice, music, SFX | Implemented | MultitrackAudioEditor separate lanes, clip timing, trim, gain, mute and solo; extra texture lane, waveform display and owner-scoped mixed-audio handoff |
| 7 reference presets (podcast, two-host, bass/beat, acoustic, cinematic, radio, clear social voice) | Implemented as **editable EQ/duck starting values** | MASTERING_PROFILES + applyMasteringProfile; does not imply neural/mastered LUFS output |
| Pink/white/brown noise, tone | Implemented | Browser-local, deterministic synthesis. Pink noise is a broadband 1/f spectrum, **not a single special frequency** |
| 432/528/639/741/852 Hz carrier and 2.5/6/7.83/10/18 Hz ear differences, pink bed | Implemented as local stereo texture | mediaBinauralPresets; headphones for distinct left/right signal. No clinical benefit, memory improvement or neural entrainment claim |
| Voice prominence and background music auto-duck | Implemented with **voice-lane signal-energy gating** | Duck depth -3/-6/-12/-18 dB or off, attack, release and lookahead; this is not semantic AI speech recognition or real neural stem separation |
| Audio EQ / 2–4kHz speech-band carve | Implemented | low/mid/high EQ, low/high cuts, 2.8kHz adjustable peaking carve, Q, stereo pan, fades |
| Master compressor | Implemented, browser-native | Threshold/ratio and A/B bypass; not calibrated true-peak limiting |
| A/B audition, local export and timeline keyframes | Implemented as editable bypass, per-track volume keyframes and 16-bit WAV | 180s maximum; keyframes can be saved/restored in settings-only DSP JSON, nothing is uploaded or posted |
| Dynamic de-esser, acoustic room restoration, true peak -0.1dBTP, **integrated -14/-16/-18 LUFS measurement** | **Not implemented / not certified** | Need approved, tested loudness-meter, accurate true-peak oversampling and dynamic sibilance processing before adding metrics; existing profile target numbers are labels only |
| Native 48 kHz/24-bit-float render | Not implemented | Current mix exports 44.1 kHz 16-bit PCM WAV. Do not state 48k/24-bit support |
| Real AI speech/music/SFX decomposition, AI score or provider-backed audio/video creation | Not implemented | Needs authorized provider adapter, quota receipts, audio rights, provenance, error and privacy acceptance |
| TikTok/Reels/Shorts platform variants and side-by-side edit | Implemented for preview, PNG batch export and bounded selected-video browser export | Source unchanged. MediaRecorder and canvas capture can produce a downloaded WebM or MP4 file with original/layered audio, where supported. Platform upload approval, codec, true AV synchronization and batch video export are not yet verified |
| Clip reframe, exposure, contrast, saturation, speed, volume, trim markers | Implemented as per-platform preview settings and selected local export | Original video remains untouched; browser encoder compatibility must be verified |
| Video platform safe zones and captions | Approximate visual editing guidance | Shaded safe zone is **not** validated against each platform's current placement rules or upload acceptance |
| Research-timed attention/interest cue and video scene-cut measurements | Directional only | Measured sampled frame changes + editable storyboard markers; **not** a calibrated probability or universal timing optimum |
| Publish to connected platforms | Preserved existing review/permissions only | No action in editor auto-posts; external delivery requires verified authorization and consent |

## Next acceptance work
Run all root/web tests, full local build, accessibility and keyboard/mobile browser checks, browser decoder/MediaRecorder/CORS behavior, sound render verification including clipping/duck behavior across sample rates, performance under multiple long clips, and media owner/session transition tests. Confirm original Stitch preset labels are distinguishable from verified metrics. No production release without the owner-mandated pre-build gate.

## 2026-11-25 reconciliation checkpoint
- Latest main-branch payment and Cosmic Humanism changes were combined into this development branch with a two-parent merge; the production branch remains unchanged.
- Bounded local video export uses canvas capture + MediaRecorder. The selected platform version can be downloaded, with original or layered audio where browser routing is available. This is not a certified provider-ready asset or a validated multi-platform video export bundle.
- Added per-track non-destructive volume keyframe envelopes in preview and WAV rendering and in validated DSP preset import/export.
- Complete repository tests, local compilation, provider and device acceptance remain unverified and continue to block production deployment.
