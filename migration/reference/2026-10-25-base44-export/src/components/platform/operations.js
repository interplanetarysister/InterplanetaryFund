// FundForge Operational Maturity & Governance — the capstone of Phase 5.
// Measures how the platform evolves from manual operations to an intelligent,
// self-improving enterprise, and the governance bodies that keep it coherent.

export const maturityLevels = [
  { level: 1, name: "Manual Operations", desc: "Processes run on human effort; deployments, recovery, and monitoring are manual." },
  { level: 2, name: "Standardized Processes", desc: "Repeatable procedures and documentation bring consistency across teams." },
  { level: 3, name: "Automated Operations", desc: "CI/CD, automated testing, observability, and rollback are the default." },
  { level: 4, name: "Predictive Operations", desc: "SLOs, capacity forecasting, and anomaly detection anticipate issues before impact." },
  { level: 5, name: "Intelligent Autonomous Platform", desc: "Mission Control advises on operations; governance keeps humans in authority over high-impact change." },
];

export const governanceBodies = [
  { name: "Platform Governance Council", scope: "Standards, architecture compliance, reliability objectives, cross-team coordination." },
  { name: "Engineering Review Board", scope: "Shared libraries, engineering standards, major dependency additions, technical conflicts." },
  { name: "Security Governance Board", scope: "Security policies, threat evaluation, compliance initiatives, AI security controls." },
  { name: "AI Governance Board", scope: "New agents, model updates, autonomous capabilities, high-impact AI incidents." },
  { name: "UX Governance Council", scope: "Design consistency, accessibility oversight, component approval, internationalization." },
  { name: "Quality Engineering Council", scope: "Release standards, testing strategy, automation governance, accessibility compliance." },
];

export const sreObjectives = [
  { label: "SLOs", desc: "Every service defines measurable targets — API latency, workflow completion, AI response, donation availability." },
  { label: "SLIs", desc: "Availability, latency, throughput, error rate, queue depth, recovery time — the data behind SLO compliance." },
  { label: "Error Budgets", desc: "When a budget is exhausted, engineering prioritizes reliability over new functionality." },
  { label: "Blameless Postmortems", desc: "Every significant incident produces timeline, root cause, and preventive improvements — not blame." },
];

export const devSecOpsLifecycle = [
  "Plan", "Develop", "Build", "Test", "Secure", "Deploy", "Monitor", "Improve",
];

export const qualityGates = [
  "Functional validation", "Security validation", "Accessibility validation",
  "Performance validation", "AI validation", "Documentation complete",
  "Rollback readiness", "Operational approval",
];