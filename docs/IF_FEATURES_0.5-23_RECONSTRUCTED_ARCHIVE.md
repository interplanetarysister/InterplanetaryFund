# Interplanetary Fund — IF Features Archive Reconstruction
## IF Features #0.5–#23

**Archive status:** Reconstructed from the available conversation context, retained project context, and approved decisions.

**Important fidelity note:** The literal final rough-draft messages for IF Features #1–#21 are not currently available as verbatim message content in the active conversation context. Therefore, those entries preserve as much of the approved substance, decisions, requirements, and implementation intent as can be recovered, but MUST NOT be represented as verbatim copies of the original archived messages.

IF Features #0.5, #22, and #23 have their final rough-draft text available in the current conversation and can be preserved verbatim separately.

---

# IF Features #0.5
## Archived Feature Backlog Verification & GitHub Implementation Reference

Special pre-implementation process, not an end-user feature.

Purpose:
- Reconstruct and reconcile the full archived backlog.
- Compare archived intent against the actual `interplanetary-fund2` codebase.
- Also audit `InterplanetaryFund` and `interplanetary-fund-backend`.
- Classify each requirement as already implemented, partially implemented, refinement, broken, missing, deferred, replaced/superseded, or duplicate existing work.
- Preserve existing architecture and avoid unnecessary rebuilding.
- Verify dependencies and implementation order.
- Audit AI agent capabilities, specialization, execution ability, permissions, and approval boundaries.
- Verify integrations are real rather than placeholders.
- Prepare accurate GitHub implementation references.
- Preserve all deferred work so nothing is silently forgotten.
- Apply the simplicity-first rule to every feature.

Core rule:
> Before building anything, know exactly what we already have, exactly what we intended to build, exactly what is missing, and exactly what should remain deferred.

The three repositories are one connected product history:
- `interplanetary-fund2`: current user-facing application.
- `InterplanetaryFund`: authoritative Convex/backend/agent runtime.
- `interplanetary-fund-backend`: legacy/reference source to audit before retirement.

Implementation status categories:
- Already implemented — verify, preserve, do not rebuild.
- Partially implemented — complete only missing portions.
- Implemented but needs refinement — improve existing implementation.
- Broken/incorrect — repair existing implementation.
- Not implemented — create implementation work.
- Deferred — preserve as an explicit checkpoint.
- Replaced/superseded — document and do not resurrect obsolete architecture.

GitHub preparation:
Each surviving feature should become an implementation reference containing purpose, existing work, partial work, broken work, missing work, deferred work, required changes, preserved architecture, UX requirements, agent requirements, dependencies, and acceptance criteria.

Required development workflow:
Agent 1 builds → Agent 2 reviews → Agent 1 applies corrections/improvements → Agent 3 audits → Agent 1 publishes only after approval.

Platform-wide simplicity rule:
> Interplanetary Fund should be powerful underneath and simple on top. A child should be able to understand and use the basic campaign flow. Advanced functionality must be progressively disclosed rather than forced into the basic experience.

---

# IF Features #1–#8
## Recovered high-level archived intent

The retained project context confirms these were part of the original archived feature backlog and were developed individually before being archived. Their literal final drafts are not retrievable here, so the following is a reconstruction of the preserved substance rather than a claim of exact wording.

Known platform/product principles carried through these features:
- Interplanetary Fund is a universal crowdfunding/funding platform.
- Campaign creation should be simple and mobile-first.
- Campaigns can use AI assistance for stories, imagery, planning, and optimization.
- Mission Control is the central AI-assisted operating area.
- Campaign Coach provides recommendations and assistance.
- AI should recommend intelligently and execute only within explicit permissions/approval rules.
- Communication should be unified across email and in-app channels.
- Community and organization capabilities should integrate with campaigns.
- Analytics should be useful without overwhelming ordinary users.
- Trust/transparency should be visible but understandable.
- Real social integrations and one-click distribution are intended; placeholder UI must not be treated as complete.
- External crowdfunding platforms such as GoFundMe, Kickstarter, and Indiegogo were considered for distribution, but the later financial architecture requires IF to remain the authoritative funding/payment path rather than blindly adopting historical direct-collection architecture.
- Mobile bottom navigation and mobile-first UX are important.
- Existing functionality must be preserved and extended rather than rebuilt.

---

# IF Feature #9
## AI Agent Capability, Expertise & Action Expansion

Preserved requirements:
- AI agents should have substantially less-stunted capabilities.
- Each agent should be particularly knowledgeable in the field represented by its name, title, and description.
- Agents should be able to research their domain and use relevant information intelligently.
- Agents should be able to make changes when the user asks, subject to permissions and safety boundaries.
- Agents should be able to apply approved recommendations directly to campaigns.
- Agents should be able to run authorized automations when asked.
- Agents should be capable of creating, editing, organizing, researching, analyzing, communicating, and executing appropriate tasks rather than merely discussing them.
- The user should not have to perform technical intermediary steps for actions the agent is authorized to perform.
- Agents should collaborate when a task spans multiple domains.
- Agent execution must remain permission-aware and auditable.
- High-impact/restricted actions can still require explicit approval.

Research-backed numbers requirement:
When a user asks an AI agent to turn a goal into an itemized spending plan, the agent should research realistic costs and produce sensible numbers rather than arbitrary placeholder figures.

Example preserved intent:
A $50,000 goal might be broken into researched categories such as:
- materials
- labor
- advertising
- maintenance
- licensing
- rent
- other relevant costs

The exact figures should be based on research relevant to the campaign's actual goal, location, industry, scale, and assumptions. The AI should distinguish research-backed estimates from verified facts and user-provided numbers.

Simple user experience:
The complexity of research, budgeting, agent coordination, and automation should remain behind a simple chat/request experience.

---

# IF Features #10
## Recovered intent

The exact archived draft is unavailable, but the preserved backlog context indicates the feature set continued the platform's expansion of intelligent campaign operation, automation, and user assistance.

Known constraints:
- Must integrate with existing Mission Control/Campaign Coach architecture.
- Must not create duplicate AI systems.
- Must remain simple for ordinary users.
- Advanced controls should be optional.
- Existing implementation must be audited before new work is assigned.

---

# IF Features #11–#13
## Recovered intent

The exact original drafts are unavailable in the active context. Preserved product context indicates these feature areas were concerned with expanding the platform's campaign, AI, creative, distribution, analytics, communication, and/or operational capabilities.

Known requirements that apply:
- Preserve existing implementation.
- Integrate with existing Campaign Operating System.
- Use AI for assistance, research, generation, and execution where authorized.
- Do not make the interface complicated.
- Ensure mobile usability.
- Keep advanced capabilities behind progressive disclosure.
- Real integrations are required where a feature claims to be connected.
- Avoid duplicate architecture.

---

# IF Feature #14
## Opportunity Discovery / Outreach Intelligence

Recovered from retained backlog:
- AI should help campaigns find appropriate opportunities and audiences.
- The system can discover relevant organizations, communities, opportunities, and outreach targets.
- Recommendations should be relevant rather than mass-spam.
- AI should research opportunities and explain why they are relevant.
- Users should be able to approve actions.
- The platform may support automation for outreach when authorized.
- Privacy and permissions must prevent exposing private individuals simply because they might donate.
- Opportunity information should distinguish verified information, user-provided information, research-backed estimates, and uncertain results.
- Trust/safety from IF #22 must protect users from suspicious opportunities.
- Community capabilities from IF #23 should integrate with opportunity discovery.

---

# IF Feature #15
## Recovered intent

The exact archived final draft is not available. Preserved requirements indicate continued development of platform intelligence and user-facing campaign support.

The feature must:
- build on existing systems,
- avoid duplicating existing functionality,
- integrate with AI agents,
- remain simple,
- support advanced functionality without forcing it on ordinary users,
- respect permissions and approval,
- be mobile-first.

---

# IF Feature #16
## Recovered intent

The exact archived final draft is not available. The retained project context indicates this stage of the backlog included platform-level completeness/audit expectations.

Known platform-wide requirements:
- Audit every major user flow.
- Check buttons, links, menus, forms, AI interactions, payment flows, permissions, mobile responsiveness, accessibility, performance, error handling, security, and broken content.
- Identify placeholders that are presented as if functional.
- Ensure data persists correctly.
- Verify backend/frontend schema compatibility.
- Verify real integrations.
- Do not declare completion merely because UI exists.

---

# IF Feature #17
## Unified Communication Hub

Recovered requirements:
- Unified Email + In-App communication.
- Communication preferences.
- Campaign updates.
- Supporter communication.
- AI-generated communications with approval/authorization.
- Automated communication where authorized.
- Notifications and inbox behavior.
- Communication history/auditability.
- Privacy and permissions.
- Integration with Community, Campaigns, Mission Control, and AI agents.
- Agents should be able to prepare and, where authorized, send communications.
- The user should not have to configure complicated communication systems.
- Existing communication infrastructure must be preserved and hardened rather than replaced.

Known technical issue from prior audits:
Application code referenced user communication preferences (`comm_prefs`) and onboarding fields that needed to be represented correctly in the User schema. This is an example of #0.5's schema-reconciliation requirement.

---

# IF Feature #18
## Distribution / Multi-Platform Publishing

Recovered requirements:
- One-click sharing/cross-posting.
- Real social platform connections.
- Facebook Pages.
- Instagram.
- TikTok.
- LinkedIn.
- User authorization/consent.
- Account-level connections reusable across campaigns.
- Reliable publishing, not merely UI.
- Publishing status and error handling.
- Campaign content should be adaptable to each destination.
- AI can prepare platform-specific versions.
- User approval/authorization controls publication.
- Distribution results should feed analytics.
- External crowdfunding platforms may be distribution destinations, but IF remains the authoritative financial flow under later approved architecture.
- GoFundMe, Kickstarter, and Indiegogo were identified as coming-soon/deferred rather than falsely represented as complete.

Important distinction:
Historical backend work included direct external-platform fundraising and balance migration. Later product direction superseded that approach: external platforms are for outreach/distribution while funds should route through IF's approved financial architecture.

---

# IF Feature #19
## Analytics / Intelligence / Campaign Performance

Recovered requirements:
- Campaign analytics.
- Reporting.
- AI interpretation of campaign performance.
- Useful research-backed projections.
- Conversion/engagement/funding insights.
- Clear summaries for ordinary users.
- Advanced analytics available for users who want them.
- Avoid presenting estimates as facts.
- Explain data limitations.
- AI can identify opportunities and recommend next actions.
- Analytics should integrate with Campaign Coach, Mission Control, Distribution, Community, and Communication.
- Mobile-friendly.
- Avoid overwhelming users with dashboards full of unnecessary information.

Known simplicity decision:
Analytics should answer simple questions such as:
- How am I doing?
- Am I on track?
- What should I do next?
rather than forcing users to understand technical analytics terminology.

---

# IF Feature #20
## Premium / Subscription AI Capabilities

Recovered requirements:
- Subscription/paid AI assistance.
- Users can hire AI to perform authorized outreach/other work while they are offline.
- Recurring subscription options.
- Premium automation must still obey permissions, safety, trust, and approval rules.
- Subscription/payment infrastructure already exists and should be reused.
- Premium does not bypass security.
- AI agents should be capable of actually performing authorized work, not just generating recommendations.
- Usage/automation should be transparent.
- User can control or stop automation.
- Billing must be reliable and secure.
- Existing Stripe/payment architecture should be reused rather than creating a second system.

---

# IF Feature #21
## Help / Guidance / User Assistance

Recovered requirements:
- Simple Help experience.
- Explain connections and platform functionality in plain language.
- Explain how social/crowdfunding connections work.
- Help users resolve verification, trust, campaign, payment, communication, and AI issues.
- Contextual help should appear where needed.
- Avoid technical jargon.
- Help should not force users through complicated documentation for simple tasks.
- Integrate with AI agents so users can ask for assistance naturally.
- Mission Control/Campaign Coach should surface useful next steps.
- The Help system should reinforce the child-simple UX principle.

---

# IF Feature #22
## Trust, Verification & Safety Intelligence

The canonical final rough draft was archived in the conversation and should be preserved verbatim from that message.

Core requirements:
- Simple trust signals.
- Layered verification.
- Campaign trust headers.
- Verification explanations.
- Use-of-funds transparency.
- AI verification assistance.
- Claim checking.
- Research-backed claims distinguished from facts.
- Financial consistency checks.
- Campaign-change monitoring.
- Donation protection.
- Suspicious-activity handling.
- Trust Agent specialization.
- Authorized Trust Agent execution.
- Human review for serious enforcement.
- Trust explanations.
- Donor protection.
- Campaign-creator protection.
- Organization verification.
- Sponsor trust.
- Document verification.
- Identity verification.
- Campaign verification.
- Trust lifecycle.
- Trust history.
- Appeals.
- False-positive protection.
- No unexplained trust score for ordinary users.
- Privacy and least privilege.
- AI access control.
- Security events.
- Agent protection and prompt-injection resistance.
- Communication safety.
- Opportunity safety.
- Publishing safety.
- Analytics safety.
- Premium safety.
- Simple user experience.
- Trust alerts.
- Proactive trust assistance.
- Trust and onboarding.
- Trust and Help.
- Trust and Mission Control.
- Trust and Campaign Coach.
- Data architecture for verification/trust events/reviews/evidence/appeals/security events.
- Full testing and Agent 2/Agent 3 review.

Core principle:
> Interplanetary Fund should do the complicated trust and safety work behind the scenes while giving users simple, honest signals about what has been verified, what needs attention, and why.

---

# IF Feature #23
## Community & Supporter Network

The canonical final rough draft was archived in the conversation and should be preserved verbatim from that message.

Core requirements:
- Simple community layer.
- Campaign communities.
- Follow instead of complicated joining.
- Supporter relationships.
- Simple supporter profiles.
- Privacy by default.
- Campaign updates.
- Impact updates.
- Community discussions.
- Simple comments.
- Moderation.
- Community safety.
- Community AI assistance.
- “Help me build support.”
- Supporter discovery.
- Community discovery.
- Local communities.
- Cause-based communities.
- Organization communities.
- Volunteer opportunities.
- Volunteer matching.
- Events.
- Community calendar.
- Community announcements.
- Supporter recognition.
- Community milestones.
- Community-created content.
- Resource sharing.
- Community recommendations.
- Community-to-campaign connections.
- Campaign-to-community connections.
- Community partnerships.
- Community communication.
- Community analytics.
- Community health.
- AI recommendations.
- Automated community workflows.
- Community Agent execution.
- Agent collaboration.
- AI moderation assistance.
- Community rules.
- Reporting.
- Trust integration.
- Help integration.
- Premium integration.
- Community data architecture.
- Full testing and Agent 2/Agent 3 review.

Core principle:
> Interplanetary Fund should make it easy for people who care about the same things to find each other, help each other, and stay connected—without turning the platform into a complicated social network.

---

# Cross-feature decisions that MUST be preserved

## Universal simplicity rule
A child should be able to create a basic campaign and understand the primary actions.

## Advanced functionality
Advanced functionality should exist, but be progressively disclosed.

## AI agents
Agents should be capable, specialized, research-oriented, and able to execute authorized changes—not merely chat.

## Research-backed numbers
When agents provide budgets, projections, estimates, or category allocations, they should research realistic costs and clearly identify assumptions.

## Existing platform
A substantial portion of the platform is already built. Archived features are NOT instructions to rebuild the application from scratch.

## Three-repository reconciliation
Always compare:
1. `interplanetary-fund2`
2. `InterplanetaryFund`
3. `interplanetary-fund-backend`

## Legacy backend
Do not delete or ignore historical capabilities until unique production-relevant work has been audited.

## Financial architecture
Do not create parallel financial systems. Reconcile historical financial work against the authoritative current implementation.

## External platforms
Distinguish real publishing/connectors from placeholder UI. Historical direct-collection designs were superseded by the later IF financial architecture.

## Deferred work
Deferred items must remain recorded. Video functionality was explicitly deferred.

## GitHub
Do not create duplicate issues when existing issues already cover the work. Update/continue existing work where appropriate.

## Development workflow
Agent 1 builds → Agent 2 reviews → Agent 1 corrects → Agent 3 audits → Agent 1 prepares final publication → user approves merge.

---

# Known existing platform capabilities from the reconciliation

Already present or substantially present:
- Campaign creation wizard.
- Campaign editor.
- Campaign detail pages.
- Campaign updates.
- Campaign following.
- Donation flows.
- Stripe-related payment infrastructure.
- PayPal-related infrastructure.
- Cash App UI/integration work.
- Google Pay-related work.
- Connections/platform management.
- Withdrawals.
- Treasury snapshot/infrastructure.
- Analytics.
- Community pages/features.
- Volunteer/community functionality.
- Subscriptions.
- AI agents.
- Agent automation.
- Agent memory infrastructure.
- Mission Control / operating intelligence.
- Campaign Coach.
- Onboarding.
- Communication infrastructure.
- Platform administration.
- OAuth/consent routing work.
- Social authorization work.
- Distribution/post infrastructure.
- Trust/fraud-related infrastructure.

These should be audited and refined rather than rebuilt.

---

# Historical capabilities requiring reconciliation

The legacy backend contained or planned:
- external-platform publishing;
- external platform balances;
- fund migration;
- payout systems;
- treasury;
- banking/ledger infrastructure;
- Stripe;
- PayPal;
- recurring donations;
- donation records;
- platform fees;
- processing fees;
- transaction ingestion;
- webhooks/polling;
- campaign lifecycle systems;
- organizer accounts;
- Android/mobile history;
- specialized AI agents;
- persistent agent memory;
- scheduled backend automation;
- campaign protocol enforcement.

These are historical evidence, not automatically current requirements.

---

# Final purpose of this reconstruction

This document is intended to preserve as much of the archived project knowledge as possible until the exact original #1–#21 messages can be recovered.

It MUST NOT be used to claim that the reconstructed sections are verbatim copies of the original archived rough drafts.

For implementation, the agents should use:
1. exact recovered archive text where available;
2. this reconstruction for preserved intent;
3. the actual three repositories;
4. existing GitHub issues and PRs;
5. IF Features #0.5 reconciliation rules.

The final implementation goal is:
> Continue building Interplanetary Fund from the substantial platform that already exists, without losing archived requirements, rebuilding working systems, resurrecting superseded architecture, or overwhelming users with complexity.
