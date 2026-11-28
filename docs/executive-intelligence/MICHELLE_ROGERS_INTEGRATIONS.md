# Michelle Rogers Executive Intelligence — Integrations & Connected Channels
**Document ID:** MR-INT-001  
**Executive:** Michelle Rogers  
**Email Identity:** `michelle@interplanetaryfund.com`  

---

## 1. Communications & Email Gateway

### Dedicated Business Email
- **Address:** `michelle@interplanetaryfund.com`
- **Routing Infrastructure:** Cloudflare Email Routing & Private Business Mail RPC.
- **Outbound Dispatch:** Gated through authenticated Cloudflare Worker service bindings (`IFUND_EMAIL_SERVICE` or verified SendGrid/Mailgun SMTP relays).
- **Inbound Processing:** Inbound emails are parsed, stripped of malicious attachments, cross-referenced against `mr_communication_suppressions`, and routed into `mr_correspondence_threads`.
- **Status Gating:** Before sending live external email, the backend verifies that the environment variable `IFUND_MICHELLE_EMAIL_ENABLED === 'true'`. In preview/test builds, outbound emails fail closed or log to sandbox audit records.

---

## 2. Calendar & Meeting Orchestration

- **Scheduling Integration:** Gated link generation with real-time calendar availability.
- **Meeting Protocol:**
  1. Investor qualified via 100-point scoring model (must score >= 60 to unlock meeting invitation).
  2. Invitation generated with unique cryptographic session token.
  3. Pre-meeting briefing packet assembled from approved `mr_data_room_documents`.
  4. Follow-up action items automatically transcribed and recorded into `mr_investor_meetings`.

---

## 3. Investor Meeting Room (`/investor-meeting`)

A purpose-built, browser-based executive conference interface accessible via unique token link:
- **Presentation Deck:** Integrated 6-slide executive deck (Cosmic Mission, Market Opportunity, Democratic Crowdfunding Engine, Technology Moat, Financial Milestones, Capital Requirement).
- **Real-Time Q&A Panel:** Structured query submission answering technical, governance, and business questions with verified corporate facts.
- **Session Transcription & Recording Consent:** Explicit dual-party opt-in toggles ensuring complete wiretap and privacy law compliance.
- **Host Presence Indicator:** Real-time indicator displaying Michelle Rogers as active and attentive.

---

## 4. Virtual Data Room (7-Folder Institutional Architecture)

Securely housed on Cloudflare R2 and served via authenticated signed URLs:
- **Folder 01:** Executive Summaries & Pitch Decks
- **Folder 02:** Corporate Governance & Formation Documents
- **Folder 03:** Financial Statements & Pro-Forma Models
- **Folder 04:** Intellectual Property & Technology Whitepapers
- **Folder 05:** Strategic Partnerships & Pipeline Opportunities
- **Folder 06:** Capitalization Table & Equity Structures (Restricted: Requires Executed NDA)
- **Folder 07:** Regulatory Filings & Compliance Attestations
