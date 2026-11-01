// FundForge Engineering Standards — the operational rules every contributor,
// AI coding assistant, and automated pipeline must follow. Companion to the
// Platform Constitution (principles) and Master Architecture Blueprint (topology).

export const engineeringPrinciples = [
  "Maintainability", "Readability", "Security", "Accessibility", "Performance",
  "Reliability", "Scalability", "Testability", "Documentation",
];

export const naming = [
  { area: "Operating Systems", pattern: "identity · campaigns · finance · communications · mission-control · communities · organizations", note: "lowercase kebab-case" },
  { area: "APIs", pattern: "POST /v1/campaigns · GET /v1/campaigns/{id} · PATCH /v1/campaigns/{id}", note: "plural nouns, resource-oriented" },
  { area: "Events", pattern: "Campaign.Created · Donation.Completed · Organization.Verified · Workflow.Completed", note: "Entity.Action — past tense, completed facts" },
  { area: "Workflows", pattern: "CampaignApprovalWorkflow · GrantRecommendationWorkflow · VolunteerOnboardingWorkflow", note: "descriptive PascalCase" },
  { area: "Commands", pattern: "CreateCampaign · ApproveGrant · VerifyOrganization · PublishCampaign", note: "requested actions" },
];

export const branches = [
  { branch: "main", purpose: "production-ready code" },
  { branch: "develop", purpose: "active integration" },
  { branch: "feature/*", purpose: "new functionality" },
  { branch: "release/*", purpose: "release stabilization" },
  { branch: "hotfix/*", purpose: "urgent production fixes" },
  { branch: "bugfix/*", purpose: "non-critical corrections" },
];

export const commits = [
  "feat(campaigns): add campaign cloning",
  "fix(finance): resolve payment retry issue",
  "docs(api): update donation endpoints",
  "refactor(identity): simplify permission service",
  "test(workflow): improve approval coverage",
  "security(auth): rotate JWT validation logic",
];

export const versioning = [
  { part: "MAJOR", meaning: "breaking architectural changes" },
  { part: "MINOR", meaning: "backward-compatible features" },
  { part: "PATCH", meaning: "bug fixes and small improvements" },
];

export const codeReview = [
  "Correct operating system ownership",
  "Architectural compliance",
  "Security considerations",
  "Accessibility impacts",
  "Performance implications",
  "API & event consistency",
  "Documentation updates",
  "Test coverage",
  "Observability instrumentation",
];

export const qualityGates = [
  "Build succeeds", "Tests pass", "Security scans pass", "Accessibility checks pass",
  "Performance thresholds met", "Documentation updated", "Linting passes",
  "Architecture validation passes", "No critical vulnerabilities", "Coverage threshold satisfied",
];

export const aiDevStandards = [
  "Follow the Constitution and respect operating system boundaries.",
  "Generate documented code with tests — no duplicate business logic.",
  "Reference shared services instead of reimplementing them.",
  "Follow naming and commit standards.",
  "Flag uncertainty rather than inventing behavior.",
  "Recommend improvements without bypassing governance.",
  "AI-generated code undergoes the same review as human-authored code.",
];

export const metrics = [
  "Build success rate", "Deployment frequency", "Lead time for changes",
  "Change failure rate", "Mean time to recovery", "Test coverage",
  "Code review turnaround", "Documentation completeness",
  "Accessibility compliance", "Security issue resolution time",
];

export const dxPlatform = [
  "One-command local environment setup", "Automated project scaffolding",
  "SDK updates", "Local workflow simulation", "Event inspection tools",
  "API explorers", "Mock service generation", "Architecture validation dashboards",
  "Documentation previews", "AI-powered developer assistance",
];