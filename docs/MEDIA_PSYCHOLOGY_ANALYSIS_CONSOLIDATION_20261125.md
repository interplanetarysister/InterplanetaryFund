# iFund Media Psychology and Audience Response — Consolidation Contract
Updated: 2026-11-25. Status: implementation contract / research-backed direction, not a trained prediction model.

## Product placement
This belongs in the existing **Growth Studio** (`/communications?tab=audience`), not a new top-level page. Media creation and editing live at `/communications?tab=media`. The existing campaign Command Center (`/analytics`) retains observed engagement and verified analytics; `/agents` retains specialist discussions and coaching. Preserve legacy routes, campaign ownership, existing provider-limited AI images, approvals, consent, and media uploads.

## The media review the user intends
Media reviews must reason about **probability of recall/memorability**, **initial attention**, **continued attention**, **desire to engage**, **trust/empathy**, **CTA conversion inclination**, and **media fatigue/overstimulation**, with audience and destination conditions made explicit. Provide actionable edit suggestions tied to specific timestamps or media segments, not arbitrary generic writing tips. Optimize for the campaign's actual audience and purpose, not maximum clicks at the expense of accuracy and dignity.

Media features include:
- Visual: first-frame focal point, human-readable subject, contrast, legibility, aspect ratio, pacing, edits/scene changes, imagery congruence, placement/timing of a CTA, transcript and captions.
- Audio: speech/silence segments, gain/peak and clipping, speech intelligibility, onset/timing of music and sound effects, abrupt changes, frequency spectrum and resonance. **Acoustic frequency and wavelength alone do not establish a universal human emotional response**; effects depend on hearing, loudness, content, culture and playback conditions. Never suggest a universal 'magic Hz' that guarantees engagement or memory.
- Copy: specificity, concreteness, natural language, narrative structure, disclosure, claims, timing of spoken vs displayed information, accessibility and intended actions.
- Context: Instagram/TikTok/YouTube/IFund feed vs mobile campaign pages, user intent, session environment, creative format, intended audience, playback muted/with sound, relevance and language.
- Per-outcome estimates: P(recall after delay), P(attention in first 1–3 sec), P(completion), P(share/comment/click), emotional response and trust, with uncertainty and per-outcome denominators. Outcomes are **not interchangeable**.

## Statistical truth and staged release
**Stage 1**: show evidence-grounded directional signals, what was measurable, missing information, possible improvements and test design. Do not display numeric recall/engagement probabilities or claim that a checklist is statistically validated. Current `audiencePostReview.mjs` is only a static text heuristic; it is not sufficient as the finished media psychology system.

**Stage 2**: build an owner-approved evaluation dataset: actual exposures, randomized assignments where practical, opt-in feedback, delayed unaided recall, engagement and completion events, relevant destination and audience conditions. Do not collect biometric or sensitive audience data by default. Consent, minimum sample sizes, data retention, integrity and privacy/RLS are prerequisites.

**Stage 3**: train/calibrate separately for each outcome and media format, compare against a baseline on held-out and time-split tests, document generalization and fairness. Display predicted **probabilities** only after calibration diagnostics (Brier score, reliability curves, calibration error), confidence bands, dataset provenance, privacy review and minimum observed sample thresholds pass. Unknown conditions remain unscored. Do not use engagement or likes as a proxy for actual memory.

**Stage 4**: monitor drift, expiration of platform-specific findings, opt-out, versioned evidence and model audit trails. Suggestions should cite relevant and current research, with peer-reviewed evidence distinguished from brand/platform marketing guidance.

## Evidence starting points (not universal scoring coefficients)
- 2025 Journal of Advertising eye-tracking validation: viewport time and early viewability measures were related to visual attention and brand recall in specific studies: https://doi.org/10.1080/00913367.2025.2524186
- 2025 Journal of Marketing study of scene cuts and visual complexity: temporally changing visual features alter attention and need segment-specific analysis: https://link.springer.com/article/10.1007/s11747-025-01137-x
- WACV 2025 ad memorability study examines emotion, scene velocity, timing, speech-to-silence, familiarity and longer-term recall; correlations are not universal causation: https://openaccess.thecvf.com/content/WACV2025/papers/Si_Long-Term_Ad_Memorability_Understanding__Generating_Memorable_Ads_WACV_2025_paper.pdf
- Audio-visual cue dual-process study describes orienting response, active attention and memory processes: https://onlinelibrary.wiley.com/doi/full/10.1002/mar.21357
- Nielsen Norman Group: small qualitative feedback sessions cannot establish reliable population-level probability estimates: https://www.nngroup.com/articles/5-test-users-qual-quant/
- Engagement prediction depends on context; avoid claiming platform-independent response likelihood: https://link.springer.com/article/10.1186/s40537-024-00955-0

## 2026–2027 product integration decisions
Progressive disclosure, mobile-first, short workflows, transparent AI assistance, per-user control, accessible interaction and reduced-motion preferences. Existing iFund applications are the source of truth. Do not add new navigation destinations for each media tool. Keep outputs as **assistance and analysis**, never unauthorized media publication. Do not replace existing marketing permissions, campaign creation, audio editing, financial receipts or paid features.
