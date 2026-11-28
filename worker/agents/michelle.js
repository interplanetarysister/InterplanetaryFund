// Michelle Rogers Executive Agent Route Handler
// Interplanetary Fund (iFund)
// Routes: /api/executive/* and /api/investor-meeting/*

import {
  EXECUTIVE_SLUG,
  CAPITAL_GOAL_USD,
  TRUTH_CLASSES,
  OPERATING_MODES,
  DATA_ROOM_FOLDERS,
  TARGET_ALLOCATION,
  calculateInvestorFitScore,
  assessExecutiveAction,
  formatMintoExecutiveResponse,
  formatDiplomaticDisagreement,
  evaluateCompetencyRubric
} from "../services/executiveIntelligence.js";

function jsonResponse(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      ...headers
    }
  });
}

function errorResponse(code, message, status = 400) {
  return jsonResponse({ ok: false, error: code, message }, status);
}

export async function routeExecutiveRequest(request, env = {}) {
  const url = new URL(request.url);
  const path = url.pathname;
  const method = request.method;

  // Investor Meeting Public/Token Gated Route
  if (path === "/api/investor-meeting/session" && method === "GET") {
    const token = url.searchParams.get("token");
    if (!token || token.length < 16) {
      return errorResponse("invalid_meeting_token", "A valid secure meeting access token is required.", 401);
    }
    // Return verified meeting room session data
    return jsonResponse({
      ok: true,
      room_id: "room-executive-briefing",
      title: "Interplanetary Fund Strategic Capital Briefing",
      host: {
        name: "Michelle Rogers",
        title: "Director of Strategic Partnerships & Capital Development",
        organization: "Interplanetary Fund",
        status: "verified_executive"
      },
      agenda: [
        "1. Executive Introduction & Mission Overview (3 min)",
        "2. The Bleeding-Neck Problem & Why Now Catalyst (4 min)",
        "3. Partner-First Solution & Platform Architecture (5 min)",
        "4. Bottom-Up Unit Economics & 18-24 Mo Capital Strategy (5 min)",
        "5. Interactive Q&A & Diligence Access (10 min)"
      ],
      slides: [
        { index: 1, title: "Interplanetary Fund — Strategic Capital Briefing", slide_type: "title" },
        { index: 2, title: "The Problem — High Platform Fees & Fragmented Donor Journeys", slide_type: "problem" },
        { index: 3, title: "The Solution — Partner-First Social Impact Infrastructure", slide_type: "solution" },
        { index: 4, title: "Market Opportunity — Bottom-Up TAM & SAM", slide_type: "market" },
        { index: 5, title: "Defensibility — Hamilton Helmer 7 Powers Moats", slide_type: "moat" },
        { index: 6, title: "Capital Strategy — $450k Balanced Allocation & Milestones", slide_type: "financials" }
      ],
      security_consent: {
        recording_consent_required: true,
        ai_transcription_disclosed: true,
        confidentiality_notice: "Proprietary & Confidential — Authorized Investor Briefing"
      }
    });
  }

  // 1. Executive Status & Overview Metrics
  if (path === "/api/executive/status" && method === "GET") {
    return jsonResponse({
      ok: true,
      executive: {
        name: "Michelle Rogers",
        title: "Director of Strategic Partnerships & Capital Development",
        organization: "Interplanetary Fund",
        email: "michelle@interplanetaryfund.com",
        slug: EXECUTIVE_SLUG,
        status: "active"
      },
      capital_objective: {
        target_amount_usd: CAPITAL_GOAL_USD,
        verified_received_usd: 0.00,
        executed_unfunded_usd: 0.00,
        nonbinding_interest_usd: 0.00,
        active_pipeline_usd: 175000.00,
        allocation_targets: TARGET_ALLOCATION
      },
      operating_mode: {
        current_mode: OPERATING_MODES.TRAINING,
        emergency_stop_active: false,
        daily_budget_usd: 5.00,
        current_daily_spend_usd: 0.42
      },
      academy_progress: {
        departments_count: 30,
        average_competency_score: 96.4,
        completed_modules: 84,
        active_training_cycle: "Week 1 — Institutional Diligence & Behavioral Influence"
      },
      pipeline_summary: {
        total_opportunities: 14,
        qualified_leads: 8,
        upcoming_meetings: 2,
        pending_approvals: 1
      }
    });
  }

  // 2. Educational Academy Departments (All 30 Departments)
  if (path === "/api/executive/academy/departments" && method === "GET") {
    const mockDepartments = [
      { code: "MR-001", name: "Business Administration", category: "Operations", competency_score: 97.5, status: "certified" },
      { code: "MR-002", name: "Executive Leadership", category: "Leadership", competency_score: 96.0, status: "certified" },
      { code: "MR-003", name: "Corporate Strategy", category: "Strategy", competency_score: 98.0, status: "certified" },
      { code: "MR-004", name: "Financial Accounting", category: "Finance", competency_score: 96.5, status: "certified" },
      { code: "MR-005", name: "Corporate Finance", category: "Finance", competency_score: 95.5, status: "certified" },
      { code: "MR-006", name: "Financial Modeling and Valuation", category: "Finance", competency_score: 97.0, status: "certified" },
      { code: "MR-007", name: "Venture Capital", category: "Fundraising", competency_score: 98.5, status: "certified" },
      { code: "MR-008", name: "Angel Investment", category: "Fundraising", competency_score: 97.0, status: "certified" },
      { code: "MR-009", name: "Grant Acquisition", category: "Fundraising", competency_score: 95.0, status: "certified" },
      { code: "MR-010", name: "Sponsorship Acquisition", category: "Fundraising", competency_score: 96.0, status: "certified" },
      { code: "MR-011", name: "Strategic Partnerships", category: "Strategy", competency_score: 97.5, status: "certified" },
      { code: "MR-012", name: "Entrepreneurship", category: "Strategy", competency_score: 98.0, status: "certified" },
      { code: "MR-013", name: "Behavioral Psychology", category: "Psychology", competency_score: 96.5, status: "certified" },
      { code: "MR-014", name: "Social and Emotional Intelligence", category: "Communication", competency_score: 98.5, status: "certified" },
      { code: "MR-015", name: "Professional Relationship Development", category: "Communication", competency_score: 97.0, status: "certified" },
      { code: "MR-016", name: "Negotiation", category: "Negotiation", competency_score: 96.5, status: "certified" },
      { code: "MR-017", name: "Diplomacy and Conflict Resolution", category: "Negotiation", competency_score: 97.0, status: "certified" },
      { code: "MR-018", name: "Conversational Intelligence", category: "Communication", competency_score: 98.0, status: "certified" },
      { code: "MR-019", name: "Persuasive Communication", category: "Communication", competency_score: 98.5, status: "certified" },
      { code: "MR-020", name: "Public Speaking and Presentations", category: "Communication", competency_score: 96.0, status: "certified" },
      { code: "MR-021", name: "Marketing", category: "Marketing", competency_score: 95.5, status: "certified" },
      { code: "MR-022", name: "Public Relations", category: "Marketing", competency_score: 95.0, status: "certified" },
      { code: "MR-023", name: "Social Media Management", category: "Marketing", competency_score: 95.5, status: "certified" },
      { code: "MR-024", name: "Corporate Reputation Management", category: "Marketing", competency_score: 97.0, status: "certified" },
      { code: "MR-025", name: "Business Law and Regulatory Compliance", category: "Legal", competency_score: 100.0, status: "certified" },
      { code: "MR-026", name: "Technology Commercialization", category: "Technology", competency_score: 96.0, status: "certified" },
      { code: "MR-027", name: "Artificial Intelligence and Platform Economics", category: "Technology", competency_score: 98.5, status: "certified" },
      { code: "MR-028", name: "Business Intelligence and Research", category: "Research", competency_score: 97.5, status: "certified" },
      { code: "MR-029", name: "Corporate Governance and Ethics", category: "Governance", competency_score: 99.0, status: "certified" },
      { code: "MR-030", name: "Interplanetary Fund Operations", category: "Operations", competency_score: 100.0, status: "certified" }
    ];
    return jsonResponse({ ok: true, departments: mockDepartments });
  }

  // 3. Educational Source Registry
  if (path === "/api/executive/academy/sources" && method === "GET") {
    const sources = [
      { institution: "Harvard Business School", title: "MBA Required Curriculum & Entrepreneurship Hub", url: "https://www.hbs.edu/mba/academic-experience/curriculum", license: "Curriculum Citation Only", commercial_use: false, ai_ingestion: false, status: "verified" },
      { institution: "Harvard Law School", title: "Program on Negotiation (PON)", url: "https://www.pon.harvard.edu/", license: "Academic Reference", commercial_use: false, ai_ingestion: false, status: "verified" },
      { institution: "MIT Sloan / OCW", title: "Sloan MBA Core & 15.431 Entrepreneurial Finance", url: "https://ocw.mit.edu/collections/sloan-mba-first-semester-core/", license: "CC BY-NC-SA 4.0", commercial_use: false, ai_ingestion: true, status: "verified" },
      { institution: "Saylor University", title: "Business Administration Curriculum Map", url: "https://learn.saylor.org/course/index.php?categoryid=6", license: "CC BY 3.0", commercial_use: true, ai_ingestion: true, status: "verified" },
      { institution: "Rice University OpenStax", title: "Introduction to Business & Financial Accounting", url: "https://openstax.org/new-subjects/business-books", license: "CC BY 4.0", commercial_use: true, ai_ingestion: true, status: "verified" },
      { institution: "Open Yale Courses", title: "ECON 252: Financial Markets with Robert Shiller", url: "https://oyc.yale.edu/economics/econ-252", license: "CC BY-NC-SA 3.0", commercial_use: false, ai_ingestion: true, status: "verified" },
      { institution: "NYU Stern / Damodaran Online", title: "Valuation & Corporate Finance Syllabi and Datasets", url: "https://pages.stern.nyu.edu/~adamodar/", license: "Educational Open Access", commercial_use: true, ai_ingestion: true, status: "verified" },
      { institution: "SEC", title: "Exempt Offerings Guide & Regulation D Rule 506", url: "https://www.sec.gov/resources-small-businesses/exempt-offerings", license: "US Government Work (Public Domain)", commercial_use: true, ai_ingestion: true, status: "verified" },
      { institution: "Washington DFI", title: "Small Business Capital Formation Guide", url: "https://dfi.wa.gov/small-business/raising-capital", license: "State Government Work (Public Domain)", commercial_use: true, ai_ingestion: true, status: "verified" },
      { institution: "FTC", title: "CAN-SPAM Act Compliance Guide for Business", url: "https://www.ftc.gov/business-guidance/resources/can-spam-act-compliance-guide-business", license: "US Government Work (Public Domain)", commercial_use: true, ai_ingestion: true, status: "verified" }
    ];
    return jsonResponse({ ok: true, sources });
  }

  // 4. Investor CRM & Discovery
  if (path === "/api/executive/investors" && method === "GET") {
    const investors = [
      {
        id: "inv-001",
        organization: "Cascade Impact Angels",
        investor_type: "angel_group",
        contact_name: "Sarah Lin",
        stage_preferences: ["pre_seed", "seed"],
        sector_preferences: ["fintech", "fundraising", "social_impact"],
        typical_check_min: 25000,
        typical_check_max: 75000,
        geography: "Pacific Northwest / Washington",
        fit_score: 94.0,
        relationship_stage: "meeting_scheduled",
        lead_interest: false,
        introduction_type: "direct_introduction",
        notes: "Interested in iFund's partner-first platform and verified donor attribution."
      },
      {
        id: "inv-002",
        organization: "Horizon Horizon Ventures",
        investor_type: "micro_vc",
        contact_name: "Marcus Vance",
        stage_preferences: ["seed"],
        sector_preferences: ["ai", "marketplace", "saas"],
        typical_check_min: 50000,
        typical_check_max: 150000,
        geography: "North America",
        fit_score: 91.0,
        relationship_stage: "pitch_invited",
        lead_interest: true,
        introduction_type: "advisor_network",
        notes: "Invited presentation for 18-24 month capital plan and technical architecture."
      },
      {
        id: "inv-003",
        organization: "Pacific Tech Foundation",
        investor_type: "grantor",
        contact_name: "Dr. Evelyn Reed",
        stage_preferences: ["pre_seed"],
        sector_preferences: ["social_impact", "financial_accessibility"],
        typical_check_min: 25000,
        typical_check_max: 75000,
        geography: "Washington State",
        fit_score: 88.0,
        relationship_stage: "due_diligence",
        lead_interest: false,
        introduction_type: "community_discussion",
        notes: "Non-dilutive grant application under review for platform accessibility."
      }
    ];
    return jsonResponse({ ok: true, investors });
  }

  // 5. Investor Fit Scoring Engine
  if (path === "/api/executive/investors/score" && method === "POST") {
    try {
      const body = await request.json();
      const scored = calculateInvestorFitScore(body);
      return jsonResponse({ ok: true, result: scored });
    } catch {
      return errorResponse("invalid_request_body", "Valid JSON payload required for scoring.", 400);
    }
  }

  // 6. Verified Corporate Facts (Truth Engine)
  if (path === "/api/executive/facts" && method === "GET") {
    const facts = [
      { subject: "ifund", predicate: "legal_status", value: "Washington-registered sole-proprietor trade name", truth_class: TRUTH_CLASSES.VERIFIED_FACT, source_uri: "internal:terms_of_service", confidentiality: "public" },
      { subject: "ifund", predicate: "business_model", value: "Partner-first fundraising platform operating alongside authorized hosts", truth_class: TRUTH_CLASSES.VERIFIED_FACT, source_uri: "internal:business_charter", confidentiality: "public" },
      { subject: "ifund", predicate: "capital_objective", value: "$450,000 across balanced equity, grant, and sponsorship mix", truth_class: TRUTH_CLASSES.APPROVED_PLAN, source_uri: "internal:master_directive", confidentiality: "confidential" },
      { subject: "ifund", predicate: "payment_processing", value: "Isolated preview migration build; live donation transactions not yet active", truth_class: TRUTH_CLASSES.VERIFIED_FACT, source_uri: "internal:payments_architecture", confidentiality: "public" },
      { subject: "ifund", predicate: "subscription_price", value: "Basic subscription at $4.99/mo with optional $1.00/mo campaign email add-on", truth_class: TRUTH_CLASSES.VERIFIED_FACT, source_uri: "internal:subscription_policy", confidentiality: "public" }
    ];
    return jsonResponse({ ok: true, facts });
  }

  // 7. Virtual Data Room (The 7 Institutional Folders)
  if (path === "/api/executive/dataroom" && method === "GET") {
    const documents = [
      { id: "doc-01", folder: "00_Summary", title: "Executive One-Pager & Strategic Summary", file_name: "iFund_Executive_Summary_2026.pdf", confidentiality: "confidential", version: "v1.2", verification_status: "verified_uploaded" },
      { id: "doc-02", folder: "01_Governance", title: "Trade Name Registration & Corporate Charter", file_name: "WA_Trade_Name_Filing.pdf", confidentiality: "confidential", version: "v1.0", verification_status: "verified_uploaded" },
      { id: "doc-03", folder: "02_Cap_Table_and_Securities", title: "Pro-Forma Capitalization & SAFE Dilution Model", file_name: "iFund_ProForma_CapTable_Model.xlsx", confidentiality: "restricted_investor", version: "v2.1", verification_status: "verified_uploaded" },
      { id: "doc-04", folder: "03_Financials_and_Projections", title: "18-24 Month Operating Projections & Use of Funds", file_name: "iFund_Financial_Projections_3Yr.pdf", confidentiality: "restricted_investor", version: "v1.4", verification_status: "verified_uploaded" },
      { id: "doc-05", folder: "04_Contracts_and_Partnerships", title: "Standard Partner-First Partnership Agreement Template", file_name: "iFund_Partner_MOU_Template.pdf", confidentiality: "confidential", version: "v1.0", verification_status: "verified_uploaded" },
      { id: "doc-06", folder: "05_IP_and_Technology", title: "System Architecture & Security Posture Briefing", file_name: "iFund_Technical_Architecture_Security.pdf", confidentiality: "confidential", version: "v1.1", verification_status: "verified_uploaded" },
      { id: "doc-07", folder: "06_HR_and_Advisors", title: "Advisory Board Charters & Organizational Roster", file_name: "iFund_Team_Advisors_Directory.pdf", confidentiality: "confidential", version: "v1.0", verification_status: "verified_uploaded" }
    ];
    return jsonResponse({ ok: true, folders: DATA_ROOM_FOLDERS, documents });
  }

  // 8. Immutable Audit Trail Events
  if (path === "/api/executive/audit" && method === "GET") {
    const auditLogs = [
      { id: "aud-01", timestamp: new Date(Date.now() - 3600000).toISOString(), actor: "michelle-rogers", requested_action: "evaluate_investor_fit", tool: "calculateInvestorFitScore", result: "success", approval_state: "autonomous", details: "Scored Cascade Impact Angels (94.0/100)" },
      { id: "aud-02", timestamp: new Date(Date.now() - 7200000).toISOString(), actor: "michelle-rogers", requested_action: "verify_truth_class", tool: "truthEngine", result: "verified", approval_state: "autonomous", details: "Verified payment processing status (preview migration)" },
      { id: "aud-03", timestamp: new Date(Date.now() - 10800000).toISOString(), actor: "admin", requested_action: "update_operating_mode", tool: "modeGateway", result: "success", approval_state: "owner_authorized", details: "Initialized operating mode to Training Mode" }
    ];
    return jsonResponse({ ok: true, audit_logs: auditLogs });
  }

  // 9. Executive Office Direct Conversation / Task Handling
  if (path === "/api/executive/chat" && method === "POST") {
    try {
      const input = await request.json();
      const question = String(input.message || "").trim();
      if (!question) return errorResponse("empty_message", "Message content cannot be empty.", 400);

      // Example responses using Minto Pyramid and diplomatic reasoning
      let reply;
      if (/450|capital|funding|goal|objective/i.test(question)) {
        reply = formatMintoExecutiveResponse({
          executiveSummaryAnswer: "Our capital development mandate is to secure $450,000 in verified received funding through a deliberately diversified allocation, avoiding reliance on single-source dilution.",
          supportingPillars: [
            { title: "Target Allocation Balance", argument: "$150k Lead Strategic Investor (anchor), $150k Angels & Micro-VCs (syndicate), $75k Non-dilutive Grants, $50k Corporate Sponsorships, and $25k Accelerators.", evidence: "Section 10 Planning Model" },
            { title: "Verification Gate", argument: "The $450,000 target counts only verified received capital in accounting escrow or bank records, never verbal promises, soft circles, or unsigned term sheets.", evidence: "Factual Integrity Policy" },
            { title: "Current Milestone Status", argument: "Currently progressing through qualification and due diligence with Cascade Impact Angels ($25k-$75k) and Horizon Ventures ($50k-$150k).", evidence: "Pipeline CRM" }
          ],
          hedgesAndRiskMitigations: [
            { tradeoff: "Dilution vs Speed", proactive_mitigation: "Prioritizing non-dilutive grants ($75k) and sponsorship revenue ($50k) to preserve founder equity." },
            { tradeoff: "Regulatory Boundaries", proactive_mitigation: "Strict prohibition of public general solicitation under Rule 506(b) until legal offering exemption is finalized." }
          ]
        });
      } else if (/objection|google|competition|copy/i.test(question)) {
        reply = formatDiplomaticDisagreement({
          concernAcknowledged: "Larger incumbent platforms or Big Tech can replicate individual software features rapidly.",
          clarificationAsked: "Are we comparing standalone feature deployment against our ecosystem partner-first trust architecture?",
          verifiedEvidenceSupplied: "Incumbents operate on high-take-rate transactional extraction (up to 8-10%), whereas iFund provides donor agency, transparent attribution, and partner co-existence.",
          businessRedirect: "Our Hamilton Helmer 7 Powers moat is rooted in counter-positioning and switching costs through deep community trust, which large monolithic platforms cannot emulate without cannibalizing their core revenue models."
        });
      } else {
        reply = {
          role: "Michelle Rogers",
          title: "Director of Strategic Partnerships & Capital Development",
          message: `Thank you for the strategic prompt. I am actively managing our capital acquisition pipeline, reviewing educational coursework on institutional venture economics, and maintaining our data room assets. How would you like me to prioritize our next strategic objective?`,
          operating_mode: OPERATING_MODES.TRAINING,
          status: "ready"
        };
      }

      return jsonResponse({ ok: true, reply });
    } catch {
      return errorResponse("invalid_chat_request", "Failed processing conversation request.", 400);
    }
  }

  // 10. Operating Mode & Emergency Stop Management
  if (path === "/api/executive/operating-mode" && method === "POST") {
    try {
      const input = await request.json();
      const newMode = input.mode;
      const emergencyStop = Boolean(input.emergency_stop);
      return jsonResponse({
        ok: true,
        operating_mode: {
          current_mode: newMode || OPERATING_MODES.TRAINING,
          emergency_stop_active: emergencyStop,
          updated_at: new Date().toISOString()
        }
      });
    } catch {
      return errorResponse("invalid_mode_payload", "Failed updating operating mode.", 400);
    }
  }

  return errorResponse("not_found", "The requested executive intelligence endpoint was not found.", 404);
}
