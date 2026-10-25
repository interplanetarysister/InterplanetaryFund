// Interplanetary Fund Platform Constitution — the permanent governing reference.
// Version 1.0. Every operating system, AI agent, workflow, API, integration,
// plugin, and future module derives authority from this document.

export const charter = {
  version: "1.0",
  status: "Foundational Governance Document",
  vision:
    "Become the world's most trusted, intelligent, and collaborative platform for funding ideas, supporting communities, empowering organizations, and connecting people with opportunities to create measurable positive impact.",
  mission:
    "Provide one unified ecosystem where users launch campaigns, raise funds, build communities, recruit volunteers, discover grants, form partnerships, manage organizations, collaborate across sectors, measure impact, and leverage AI responsibly.",
};

export const coreValues = [
  { id: "FF-VAL-001", name: "Trust", statement: "Operate transparently and protect user data." },
  { id: "FF-VAL-002", name: "Accessibility", statement: "Ensure the platform is usable by people with diverse abilities." },
  { id: "FF-VAL-003", name: "Security", statement: "Protect identities, information, and financial activity through layered security." },
  { id: "FF-VAL-004", name: "Privacy", statement: "Respect user choices and minimize unnecessary data collection." },
  { id: "FF-VAL-005", name: "Collaboration", statement: "Enable individuals and organizations to work together effectively." },
  { id: "FF-VAL-006", name: "Innovation", statement: "Encourage continuous improvement while protecting platform stability." },
  { id: "FF-VAL-007", name: "Simplicity", statement: "Hide unnecessary complexity while preserving powerful capabilities." },
  { id: "FF-VAL-008", name: "Reliability", statement: "Deliver dependable services that users can trust." },
  { id: "FF-VAL-009", name: "Inclusivity", statement: "Support users from different cultures, languages, organizations, and communities." },
  { id: "FF-VAL-010", name: "Sustainability", statement: "Design the platform so it can evolve for decades without major architectural redesign." },
];

export const immutableLaws = [
  { id: "FF-ARCH-001", law: "One capability has exactly one primary owner. No duplicate business logic is permitted." },
  { id: "FF-ARCH-002", law: "Every operating system remains independently deployable and replaceable. Evolution must not require rewriting unrelated operating systems." },
  { id: "FF-ARCH-003", law: "Operating systems communicate only through APIs, the Event Bus, and the Workflow Engine. Direct cross-system database dependencies are prohibited." },
  { id: "FF-ARCH-004", law: "Every entity follows the Universal Data Model. No operating system may introduce incompatible entity definitions." },
  { id: "FF-ARCH-005", law: "Every workflow is versioned, auditable, permission-aware, observable, and recoverable." },
  { id: "FF-ARCH-006", law: "Every API follows platform standards for authentication, authorization, versioning, documentation, observability, and error handling." },
  { id: "FF-ARCH-007", law: "Every interface complies with the shared Design System and Accessibility Standards. No independent design languages are permitted." },
  { id: "FF-ARCH-008", law: "Mission Control is an intelligent advisor. It never bypasses permissions, security policies, organizational governance, or human review." },
  { id: "FF-ARCH-009", law: "Platform Intelligence observes and analyzes. It does not modify operational business data directly." },
  { id: "FF-ARCH-010", law: "Platform Foundation provides technical services only. It never contains business logic belonging to another operating system." },
];

export const governanceHierarchy = [
  { layer: "Constitutional", purpose: "Protects the platform's foundational principles." },
  { layer: "Architectural", purpose: "Protects technical integrity." },
  { layer: "Security", purpose: "Protects users, organizations, and infrastructure." },
  { layer: "Privacy", purpose: "Protects personal information and consent." },
  { layer: "Accessibility", purpose: "Protects inclusive design standards." },
  { layer: "AI Governance", purpose: "Oversees responsible use of AI." },
  { layer: "Operational", purpose: "Protects reliability and operational excellence." },
];

export const architectureLayers = [
  { n: 1, name: "Experience", desc: "Web, mobile, admin console, enterprise & developer portals — no business logic." },
  { n: 2, name: "Experience Services", desc: "Shared navigation, search, theme, localization, accessibility, component library." },
  { n: 3, name: "API Gateway", desc: "Auth, routing, rate limiting, validation, monitoring. No external system bypasses it." },
  { n: 4, name: "Platform Core", desc: "The ten constitutional operating systems, each owning one business domain." },
  { n: 5, name: "Shared Services", desc: "Identity, permissions, search, workflow engine, event bus, audit, storage — no business logic." },
  { n: 6, name: "Data Services", desc: "Operational database, search index, analytics warehouse, object & media storage." },
  { n: 7, name: "Intelligence", desc: "Mission Control: recommendations, predictions, knowledge graph, automation — governance-enforced." },
  { n: 8, name: "Observability", desc: "Metrics, logs, tracing, audit records, health, alerts, digital twin." },
  { n: 9, name: "Infrastructure", desc: "Cloud, compute, storage, CI/CD, backup, disaster recovery — independent of business logic." },
  { n: 10, name: "Governance", desc: "Architecture, security, accessibility, privacy, AI governance — influences every layer." },
];

export const releaseRoadmap = [
  { release: "R1 — Platform Foundation", goal: "Accounts, campaigns, donations, basic communications, core dashboards. A reliable crowdfunding platform." },
  { release: "R2 — Community Platform", goal: "Communities, volunteers, events, discussions, collaboration tools." },
  { release: "R3 — Organization Platform", goal: "Businesses, nonprofits, foundations, multi-user administration, grant discovery." },
  { release: "R4 — Mission Control", goal: "AI assistants, recommendations, opportunity matching, workflow automation, predictive analytics." },
  { release: "R5 — Enterprise Platform", goal: "Multi-tenant enterprise administration, advanced compliance, marketplace, enterprise APIs." },
  { release: "R6 — Global Platform", goal: "Multiple languages, regional compliance, additional currencies, regional infrastructure." },
];

export const sharedServices = [
  "Identity", "Permission Engine", "Search", "Workflow Engine", "Event Bus",
  "Notification Engine", "Document Service", "Media Service", "Localization",
  "Accessibility Services", "Configuration", "Secrets Management", "Audit Service",
  "Logging", "Observability", "Health Monitoring", "Knowledge Repository",
];