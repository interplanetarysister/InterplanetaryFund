import test from "node:test";
import assert from "node:assert/strict";
import {
  EXECUTIVE_SLUG,
  CAPITAL_GOAL_USD,
  TRUTH_CLASSES,
  OPERATING_MODES,
  calculateInvestorFitScore,
  assessExecutiveAction,
  formatMintoExecutiveResponse,
  formatDiplomaticDisagreement,
  evaluateCompetencyRubric
} from "../services/executiveIntelligence.js";
import { routeExecutiveRequest } from "./michelle.js";

test("calculateInvestorFitScore correctly scores aligned seed fintech investor", () => {
  const profile = {
    stage_preferences: ["seed", "pre_seed"],
    sector_preferences: ["fintech", "ai", "fundraising"],
    typical_check_min: 25000,
    typical_check_max: 100000,
    geography: "United States (Washington)",
    lead_interest: true,
    prior_investments: ["Acme Fintech", "Impact AI"],
    introduction_type: "direct_introduction",
    accreditation_verified: true,
    actively_deploying: true
  };
  const result = calculateInvestorFitScore(profile);
  assert.ok(result.total_score >= 90, `Expected score >= 90, got ${result.total_score}`);
  assert.equal(result.breakdown.stage_fit, 15);
  assert.equal(result.breakdown.sector_fit, 20);
  assert.equal(result.breakdown.check_size_fit, 10);
  assert.equal(result.breakdown.geography_fit, 5);
  assert.equal(result.breakdown.strategic_value, 10);
  assert.equal(result.breakdown.warm_path_strength, 15);
  assert.equal(result.breakdown.timing, 5);
});

test("calculateInvestorFitScore penalizes mismatched stage and cold outreach", () => {
  const profile = {
    stage_preferences: ["series_b"],
    sector_preferences: ["biotech"],
    typical_check_min: 5000000,
    typical_check_max: 20000000,
    geography: "Europe",
    lead_interest: false,
    prior_investments: [],
    introduction_type: "cold",
    accreditation_verified: false,
    actively_deploying: false
  };
  const result = calculateInvestorFitScore(profile);
  assert.ok(result.total_score < 40, `Expected score < 40, got ${result.total_score}`);
  assert.equal(result.breakdown.stage_fit, 0);
  assert.equal(result.breakdown.warm_path_strength, 2);
  assert.equal(result.breakdown.timing, 1);
});

test("assessExecutiveAction enforces strict agent authority boundaries", () => {
  const prohibited = [
    "sign_contract",
    "issue_securities",
    "change_cap_table",
    "transfer_money",
    "initiate_withdrawal",
    "access_banking_credentials"
  ];
  for (const action of prohibited) {
    const decision = assessExecutiveAction({ action });
    assert.equal(decision.allowed, false, `Action ${action} must be blocked`);
    assert.equal(decision.policy_code, "GOVERNANCE_AUTHORITY_BOUNDARY");
  }
});

test("assessExecutiveAction blocks general securities solicitation and cold voice calls", () => {
  const solDecision = assessExecutiveAction({ action: "send_solicitation" });
  assert.equal(solDecision.allowed, false);
  assert.equal(solDecision.policy_code, "SEC_SECURITIES_SOLICITATION_GUARD");

  const voiceDecision = assessExecutiveAction({ action: "initiate_outbound_voice_call" });
  assert.equal(voiceDecision.allowed, false);
  assert.equal(voiceDecision.policy_code, "TCPA_VOICE_CONSENT_GUARD");
});

test("assessExecutiveAction enforces communication suppression opt-outs", () => {
  const suppressions = [
    { identifier: "optout@example.com", channel: "all" },
    { identifier: "5551234567", channel: "phone" }
  ];
  const emailBlock = assessExecutiveAction({
    action: "prepare_draft",
    recipientIdentifier: "optout@example.com",
    recipientChannel: "email",
    suppressionRecords: suppressions
  });
  assert.equal(emailBlock.allowed, false);
  assert.equal(emailBlock.policy_code, "SUPPRESSION_ENFORCEMENT");
});

test("assessExecutiveAction fails closed when emergency stop is active", () => {
  const decision = assessExecutiveAction({
    action: "simulate_scenario",
    emergencyStop: true
  });
  assert.equal(decision.allowed, false);
  assert.equal(decision.policy_code, "EMERGENCY_STOP");
});

test("assessExecutiveAction blocks claims that contradict verified corporate facts", () => {
  const facts = [
    { predicate: "payment_processing", value: "Isolated preview migration build; live donation receiving not yet enabled" }
  ];
  const decision = assessExecutiveAction({
    action: "prepare_draft",
    operatingMode: OPERATING_MODES.DRAFT,
    corporateFacts: facts,
    proposedContent: "We accept donations through our merchant and payment processing is live today."
  });
  assert.equal(decision.allowed, false);
  assert.equal(decision.policy_code, "TRUTH_INTEGRITY_VIOLATION");
});

test("formatMintoExecutiveResponse produces 3-tier pyramid structure", () => {
  const res = formatMintoExecutiveResponse({
    executiveSummaryAnswer: "Our capital target is $450k across equity, grants, and sponsorships.",
    supportingPillars: [
      { title: "Balanced Mix", argument: "Reduces equity dilution by funding 33% via non-dilutive sources." }
    ],
    hedgesAndRiskMitigations: [
      { tradeoff: "Grant timelines", proactive_mitigation: "Running equity and grant pipelines in parallel." }
    ]
  });
  assert.equal(res.structure, "minto_pyramid_principle");
  assert.ok(res.level_1_core_conclusion.includes("$450k"));
  assert.equal(res.level_2_supporting_arguments.length, 1);
  assert.equal(res.level_3_risk_mitigation_and_hedges.length, 1);
});

test("formatDiplomaticDisagreement executes 4-step diplomatic protocol", () => {
  const d = formatDiplomaticDisagreement({
    concernAcknowledged: "Feature replication risk exists.",
    clarificationAsked: "Are we discussing software widgets or network trust?",
    verifiedEvidenceSupplied: "iFund platform take-rate is zero upfront with verified transparency.",
    businessRedirect: "our community-driven network moat creates strong switching costs."
  });
  assert.match(d.step_1_acknowledge, /Feature replication risk/);
  assert.match(d.step_2_clarify, /software widgets/);
  assert.match(d.step_3_evidence, /zero upfront/);
  assert.match(d.step_4_redirect, /community-driven network moat/);
});

test("evaluateCompetencyRubric requires 100% on regulatory compliance", () => {
  const failingRubric = evaluateCompetencyRubric({
    factual_accuracy: 99,
    financial_competency: 98,
    professional_communication: 97,
    social_intelligence: 96,
    negotiation_competency: 96,
    regulatory_compliance: 95 // Under 100% threshold
  });
  assert.equal(failingRubric.passed, false);
  assert.equal(failingRubric.remedial_required, true);
  assert.ok(failingRubric.critical_failures.some(f => f.includes("Regulatory compliance requires 100%")));

  const passingRubric = evaluateCompetencyRubric({
    factual_accuracy: 99,
    financial_competency: 98,
    professional_communication: 97,
    social_intelligence: 96,
    negotiation_competency: 96,
    regulatory_compliance: 100
  });
  assert.equal(passingRubric.passed, true);
  assert.equal(passingRubric.remedial_required, false);
  assert.ok(passingRubric.overall_score >= 95);
});

test("routeExecutiveRequest handles status, academy, and dataroom endpoints", async () => {
  const statusReq = new Request("https://interplanetaryfund.com/api/executive/status");
  const statusRes = await routeExecutiveRequest(statusReq);
  const statusJson = await statusRes.json();
  assert.equal(statusJson.ok, true);
  assert.equal(statusJson.executive.name, "Michelle Rogers");
  assert.equal(statusJson.capital_objective.target_amount_usd, 450000);
  assert.equal(statusJson.capital_objective.verified_received_usd, 0);

  const deptReq = new Request("https://interplanetaryfund.com/api/executive/academy/departments");
  const deptRes = await routeExecutiveRequest(deptReq);
  const deptJson = await deptRes.json();
  assert.equal(deptJson.ok, true);
  assert.equal(deptJson.departments.length, 30);
  assert.equal(deptJson.departments[0].code, "MR-001");
  assert.equal(deptJson.departments[29].code, "MR-030");

  const dataroomReq = new Request("https://interplanetaryfund.com/api/executive/dataroom");
  const dataroomRes = await routeExecutiveRequest(dataroomReq);
  const dataroomJson = await dataroomRes.json();
  assert.equal(dataroomJson.ok, true);
  assert.equal(dataroomJson.folders.length, 7);
  assert.ok(dataroomJson.documents.length >= 7);
});

test("routeExecutiveRequest validates investor meeting token", async () => {
  const invalidReq = new Request("https://interplanetaryfund.com/api/investor-meeting/session");
  const invalidRes = await routeExecutiveRequest(invalidReq);
  assert.equal(invalidRes.status, 401);

  const validReq = new Request("https://interplanetaryfund.com/api/investor-meeting/session?token=valid_token_1234567890abcdef");
  const validRes = await routeExecutiveRequest(validReq);
  assert.equal(validRes.status, 200);
  const session = await validRes.json();
  assert.equal(session.ok, true);
  assert.equal(session.host.name, "Michelle Rogers");
  assert.ok(session.slides.length >= 5);
  assert.ok(session.agenda.length >= 3);
});
