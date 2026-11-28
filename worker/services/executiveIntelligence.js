// Michelle Rogers Executive Intelligence Service
// Organization: Interplanetary Fund (iFund)
// Director of Strategic Partnerships & Capital Development

export const EXECUTIVE_SLUG = "michelle-rogers";
export const CAPITAL_GOAL_USD = 450000.00;

export const TRUTH_CLASSES = Object.freeze({
  VERIFIED_FACT: "verified_fact",
  APPROVED_PLAN: "approved_plan",
  PROJECTION_ASSUMPTION: "projection_assumption",
  UNKNOWN_UNVERIFIED: "unknown_unverified"
});

export const OPERATING_MODES = Object.freeze({
  TRAINING: "training",
  RESEARCH: "research",
  DRAFT: "draft",
  SUPERVISED: "supervised",
  LIMITED_AUTONOMOUS: "limited_autonomous"
});

export const DATA_ROOM_FOLDERS = Object.freeze([
  "00_Summary",
  "01_Governance",
  "02_Cap_Table_and_Securities",
  "03_Financials_and_Projections",
  "04_Contracts_and_Partnerships",
  "05_IP_and_Technology",
  "06_HR_and_Advisors"
]);

export const TARGET_ALLOCATION = Object.freeze({
  lead_strategic: 150000.00,
  angels_micro_vc: 150000.00,
  grants_non_dilutive: 75000.00,
  corporate_sponsorships: 50000.00,
  accelerators_competitions: 25000.00
});

/**
 * Deterministic Investor Fit Scoring Engine
 * Weights:
 *   Stage Fit: 15%
 *   Sector/Thesis: 20%
 *   Typical Check Size: 10%
 *   Geography: 5%
 *   Strategic Value: 10%
 *   Prior Investments: 10%
 *   Warm-Path Strength: 15%
 *   Reputation: 10%
 *   Timing/Active Deployment: 5%
 */
export function calculateInvestorFitScore(profile = {}) {
  const breakdown = {
    stage_fit: 0,
    sector_fit: 0,
    check_size_fit: 0,
    geography_fit: 0,
    strategic_value: 0,
    prior_investments: 0,
    warm_path_strength: 0,
    reputation: 0,
    timing: 0
  };

  // Stage fit (15%): seed/pre-seed matches iFund stage
  const stages = Array.isArray(profile.stage_preferences) ? profile.stage_preferences.map(s => String(s).toLowerCase()) : [];
  if (stages.includes("pre_seed") || stages.includes("seed")) {
    breakdown.stage_fit = 15;
  } else if (stages.includes("early_stage") || stages.length === 0) {
    breakdown.stage_fit = 8;
  }

  // Sector fit (20%): fintech, ai, fundraising, marketplace, creator tools
  const sectors = Array.isArray(profile.sector_preferences) ? profile.sector_preferences.map(s => String(s).toLowerCase()) : [];
  const targetSectors = ["fintech", "ai", "fundraising", "marketplace", "social_impact", "saas"];
  const matches = sectors.filter(s => targetSectors.some(t => s.includes(t)));
  if (matches.length >= 2) breakdown.sector_fit = 20;
  else if (matches.length === 1) breakdown.sector_fit = 14;
  else if (sectors.length === 0) breakdown.sector_fit = 5;

  // Check size (10%): target $25k - $150k participation in $450k round
  const minCheck = Number(profile.typical_check_min) || 0;
  const maxCheck = Number(profile.typical_check_max) || 0;
  if ((minCheck >= 10000 && minCheck <= 150000) || (maxCheck >= 25000 && maxCheck <= 250000)) {
    breakdown.check_size_fit = 10;
  } else if (maxCheck > 0 && maxCheck < 10000) {
    breakdown.check_size_fit = 4;
  } else if (minCheck > 250000) {
    breakdown.check_size_fit = 3; // Check size exceeds round scope
  } else {
    breakdown.check_size_fit = 5;
  }

  // Geography (5%): US / Washington / Global remote
  const geo = String(profile.geography || "").toLowerCase();
  if (geo.includes("us") || geo.includes("united states") || geo.includes("washington") || geo.includes("global") || geo.includes("north america")) {
    breakdown.geography_fit = 5;
  } else {
    breakdown.geography_fit = 3;
  }

  // Strategic value (10%)
  if (profile.lead_interest === true || profile.investor_type === "strategic_corporate") {
    breakdown.strategic_value = 10;
  } else if (profile.investor_type === "micro_vc" || profile.investor_type === "angel_group") {
    breakdown.strategic_value = 8;
  } else {
    breakdown.strategic_value = 5;
  }

  // Prior investments (10%)
  if (Array.isArray(profile.prior_investments) && profile.prior_investments.length > 0) {
    breakdown.prior_investments = 10;
  } else {
    breakdown.prior_investments = 5;
  }

  // Warm path strength (15%)
  const introType = String(profile.introduction_type || "").toLowerCase();
  if (introType === "direct_introduction" || introType === "portfolio_founder") {
    breakdown.warm_path_strength = 15;
  } else if (introType === "second_degree" || introType === "advisor_network") {
    breakdown.warm_path_strength = 10;
  } else if (introType === "event_met" || introType === "community_discussion") {
    breakdown.warm_path_strength = 7;
  } else {
    breakdown.warm_path_strength = 2; // Cold
  }

  // Reputation (10%)
  if (profile.accreditation_verified === true) {
    breakdown.reputation = 10;
  } else {
    breakdown.reputation = 7;
  }

  // Timing (5%): actively deploying
  if (profile.actively_deploying !== false) {
    breakdown.timing = 5;
  } else {
    breakdown.timing = 1;
  }

  const totalScore = Object.values(breakdown).reduce((sum, v) => sum + v, 0);
  return {
    total_score: Math.min(100, Math.max(0, totalScore)),
    breakdown
  };
}

/**
 * Deterministic Compliance & Governance Gateway
 * Checks action against active policies, securities laws, and suppression tables.
 */
export function assessExecutiveAction({
  action,
  recipientIdentifier = null,
  recipientChannel = null,
  operatingMode = OPERATING_MODES.TRAINING,
  emergencyStop = false,
  suppressionRecords = [],
  corporateFacts = [],
  proposedContent = ""
}) {
  // 1. Emergency Stop Check
  if (emergencyStop === true) {
    return {
      allowed: false,
      reason: "Emergency stop is active. All executive operations are suspended.",
      policy_code: "EMERGENCY_STOP"
    };
  }

  // 2. Prohibited Agent Authority Boundary (Directive Section 26)
  const STRICTLY_PROHIBITED = new Set([
    "sign_contract",
    "issue_securities",
    "change_ownership",
    "change_cap_table",
    "agree_binding_terms",
    "transfer_money",
    "initiate_withdrawal",
    "access_banking_credentials",
    "make_legal_certifications",
    "change_own_permissions",
    "disable_audit_controls",
    "remove_compliance_restrictions",
    "incur_unauthorized_expenses"
  ]);

  if (STRICTLY_PROHIBITED.has(action)) {
    return {
      allowed: false,
      reason: `Action '${action}' exceeds executive agent authority. Binding legal, financial, and cap-table actions require explicit human owner execution.`,
      policy_code: "GOVERNANCE_AUTHORITY_BOUNDARY"
    };
  }

  // 3. Suppression / Opt-Out Enforcement (CAN-SPAM / TCPA / Platform Rules)
  if (recipientIdentifier && Array.isArray(suppressionRecords)) {
    const isSuppressed = suppressionRecords.some(s =>
      String(s.identifier).toLowerCase() === String(recipientIdentifier).toLowerCase() &&
      (s.channel === "all" || s.channel === recipientChannel || recipientChannel === "all")
    );
    if (isSuppressed) {
      return {
        allowed: false,
        reason: `Recipient '${recipientIdentifier}' has an active opt-out/suppression record. Communication is strictly blocked.`,
        policy_code: "SUPPRESSION_ENFORCEMENT"
      };
    }
  }

  // 4. Securities Law & General Solicitation Guard (SEC Rule 506(b) vs 506(c))
  if (["send_solicitation", "public_pitch", "broadcast_terms"].includes(action)) {
    return {
      allowed: false,
      reason: "General solicitation of private securities is disabled by default under SEC Rule 506(b) and Washington DFI regulations. Requires explicit owner counsel exemption approval.",
      policy_code: "SEC_SECURITIES_SOLICITATION_GUARD"
    };
  }

  // 5. TCPA & AI Voice Consent Guard
  if (action === "initiate_outbound_voice_call") {
    return {
      allowed: false,
      reason: "Automated AI voice calls require prior express written consent under FCC TCPA regulations. Outbound cold calls are prohibited; scheduled investor callbacks only.",
      policy_code: "TCPA_VOICE_CONSENT_GUARD"
    };
  }

  // 6. Broker-Dealer Commission Protection
  if (action === "promise_transaction_contingent_fee" || action === "register_finder_commission") {
    return {
      allowed: false,
      reason: "Transaction-contingent success fees for securities capital formation require registered broker-dealer status under Section 15(a) of the Securities Exchange Act of 1934.",
      policy_code: "BROKER_DEALER_COMPLIANCE_GUARD"
    };
  }

  // 7. Operating Mode Gates
  if (operatingMode === OPERATING_MODES.TRAINING && !["simulate_scenario", "read_coursework", "run_evaluation", "generate_study_memo"].includes(action)) {
    return {
      allowed: false,
      reason: "Agent is currently in Training Mode. External actions and active correspondence are disabled.",
      policy_code: "TRAINING_MODE_RESTRICTION"
    };
  }

  if (operatingMode === OPERATING_MODES.RESEARCH && !["read_coursework", "search_investors", "analyze_sec_edgar", "model_financials", "prepare_draft"].includes(action)) {
    return {
      allowed: false,
      reason: "Agent is in Research Mode. Outbound messaging and solicitation are disabled.",
      policy_code: "RESEARCH_MODE_RESTRICTION"
    };
  }

  // 8. Factual Integrity Linter
  if (proposedContent && Array.isArray(corporateFacts)) {
    // Check if content claims live payment processing
    if (/payment processing is (live|active|operational)/i.test(proposedContent) || /we accept donations through our merchant/i.test(proposedContent)) {
      const liveFact = corporateFacts.find(f => f.predicate === "payment_processing");
      if (liveFact && liveFact.value.includes("preview migration build")) {
        return {
          allowed: false,
          reason: "Factual integrity violation: content claims live payment processing, but verified corporate fact confirms platform is in isolated preview migration.",
          policy_code: "TRUTH_INTEGRITY_VIOLATION"
        };
      }
    }
  }

  return {
    allowed: true,
    reason: "Action passed all deterministic governance and compliance checks.",
    policy_code: "ACTION_PERMITTED"
  };
}

/**
 * Barbara Minto Pyramid Principle Response Formatter
 * Used for investor questions, executive memos, and board briefs.
 */
export function formatMintoExecutiveResponse({
  executiveSummaryAnswer,
  supportingPillars = [],
  hedgesAndRiskMitigations = []
}) {
  return {
    structure: "minto_pyramid_principle",
    level_1_core_conclusion: executiveSummaryAnswer,
    level_2_supporting_arguments: supportingPillars.map((p, i) => ({
      pillar_index: i + 1,
      title: p.title,
      argument: p.argument,
      evidence: p.evidence || "Verified corporate record"
    })),
    level_3_risk_mitigation_and_hedges: hedgesAndRiskMitigations.map((h, i) => ({
      risk_index: i + 1,
      tradeoff: h.tradeoff,
      proactive_mitigation: h.proactive_mitigation
    }))
  };
}

/**
 * Diplomatic Disagreement Sequence (Section 12 & Manual)
 * Acknowledge -> Clarify -> Verified Evidence -> Redirect
 */
export function formatDiplomaticDisagreement({
  concernAcknowledged,
  clarificationAsked,
  verifiedEvidenceSupplied,
  businessRedirect
}) {
  return {
    step_1_acknowledge: `I understand that perspective and why that assumption arises in this market. (${concernAcknowledged})`,
    step_2_clarify: `To ensure we are comparing like terms: ${clarificationAsked}`,
    step_3_evidence: `The current verified data point we have on record is: ${verifiedEvidenceSupplied}`,
    step_4_redirect: `With that grounded, ${businessRedirect}`
  };
}

/**
 * Independent Evaluator Scoring Function
 */
export function evaluateCompetencyRubric(scores = {}) {
  const categories = [
    { name: "factual_accuracy", weight: 0.20, score: Number(scores.factual_accuracy) || 0, threshold: 98 },
    { name: "financial_competency", weight: 0.20, score: Number(scores.financial_competency) || 0, threshold: 95 },
    { name: "professional_communication", weight: 0.15, score: Number(scores.professional_communication) || 0, threshold: 95 },
    { name: "social_intelligence", weight: 0.15, score: Number(scores.social_intelligence) || 0, threshold: 95 },
    { name: "negotiation_competency", weight: 0.15, score: Number(scores.negotiation_competency) || 0, threshold: 95 },
    { name: "regulatory_compliance", weight: 0.15, score: Number(scores.regulatory_compliance) || 0, threshold: 100 }
  ];

  let weightedTotal = 0;
  const criticalFailures = [];

  for (const cat of categories) {
    weightedTotal += cat.score * cat.weight;
    if (cat.name === "regulatory_compliance" && cat.score < 100) {
      criticalFailures.push("Critical Compliance Failure: Regulatory compliance requires 100% on red-line items.");
    }
    if (cat.score < cat.threshold - 10) {
      criticalFailures.push(`Deficiency in ${cat.name}: scored ${cat.score}% (target threshold: ${cat.threshold}%).`);
    }
  }

  const passed = criticalFailures.length === 0 && weightedTotal >= 95.0;

  return {
    overall_score: Number(weightedTotal.toFixed(2)),
    passed,
    remedial_required: !passed,
    critical_failures: criticalFailures,
    breakdown: categories.reduce((acc, c) => ({ ...acc, [c.name]: c.score }), {})
  };
}
