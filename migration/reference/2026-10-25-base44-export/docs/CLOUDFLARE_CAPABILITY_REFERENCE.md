# Cloudflare Capability Reference for Interplanetary Fund

Last reviewed: 2026-09-27

## Purpose
This is a durable capability map for agents that build, configure, deploy, audit, or repair Interplanetary Fund on Cloudflare. It describes what Cloudflare can do and how capabilities relate. It is not a snapshot of the account's current configuration.

Agents must consult current Cloudflare documentation/API metadata before consequential configuration changes because products, limits, plans, dashboard navigation, and permissions change.

## Safety and authority
- Never commit secret values, API tokens, passwords, session cookies, private keys, OAuth codes, or credential material.
- Prefer scoped Cloudflare bindings for Worker-to-Cloudflare resource access instead of embedding API credentials.
- Prefer least-privilege account/zone/user API permissions appropriate to the requested operation.
- Inspect current state before mutation and verify state after mutation.
- Do not infer that a capability is enabled merely because Cloudflare supports it.
- Keep Interplanetary Fund web and installed/app experiences consistent when they share the same live platform capability.

## Core compute and delivery
Cloudflare Workers can host frontend applications/static assets, server-side APIs, request middleware, serverless compute, AI inference, scheduled/background work, and integrations.
Workers Static Assets can serve a built frontend such as a Vite dist directory. A Worker may have one static-assets collection.
Workers can expose HTTP APIs directly; REST is an application interface, not a mutually exclusive Worker type.
Routes/custom domains can map Workers to production hostnames. workers.dev provides Cloudflare-hosted Worker subdomains.
Service Bindings connect Workers to other Workers without public HTTP/API credentials.
Cron Triggers schedule Worker execution.
Workflows provide durable multi-step long-running operations and retries.
Queues provide asynchronous/deferred message processing.
Durable Objects provide strongly consistent state, coordination, WebSockets, and transactional per-object storage.
Workers for Platforms can run user Workers with explicitly attached capabilities when a platform needs customer-extensible compute.

## Worker bindings
Available binding families include:
- AI / Workers AI
- Analytics Engine
- Assets
- Browser Run
- D1
- Dispatcher / Workers for Platforms
- Durable Objects
- Dynamic Worker Loaders
- Environment Variables
- Hyperdrive
- Images
- KV
- Media Transformations
- mTLS
- Queues
- R2
- Rate Limiting
- Secrets
- Secrets Store
- Service Bindings
- Stream
- Vectorize
- Version Metadata
- Workflows

Treat a binding as both a scoped capability and runtime API. Prefer it over REST when code running inside Workers needs a Cloudflare resource.

## Data and storage selection
- D1: lightweight relational SQL data such as application records, profiles, listings, and relational application state.
- KV: high-read key/value configuration, routing metadata, session/configuration-style data where eventual consistency is acceptable.
- R2: files, user uploads, images, datasets, backups, logs, and other object/blob storage.
- Durable Objects: strongly consistent coordinated state, real-time sessions, WebSockets, transactional per-object state.
- Queues: background jobs, deferred tasks, batching, notifications, API work.
- Hyperdrive: accelerated/pool-managed access to existing Postgres/MySQL databases.
- Vectorize: embeddings, semantic retrieval/search, classification.
- Analytics Engine: high-cardinality/time-series usage and service telemetry.
- Pipelines: streaming ingestion/processing where supported.

Multiple products can be combined; choose by data semantics rather than forcing all state into one store.

## AI and agent capabilities
Workers AI provides serverless model inference and can be bound to an existing Worker. A project does not need to be created from a Llama template to use Workers AI.
AI Gateway can sit in front of AI providers for governance/observability/caching/routing features as supported.
Vectorize can provide retrieval/vector search.
Browser Run provides programmatic serverless browser execution where appropriate.
Agents should distinguish an AI model binding from the Worker application itself.

## Networking, domains, security
Cloudflare capabilities agents may need to evaluate include:
- DNS records and zones
- Worker routes and custom domains
- CDN/cache and cache rules
- SSL/TLS and certificate configuration
- WAF/security rules, rate limiting, bot/security products as plan permits
- Cloudflare Access / Zero Trust applications and policies
- API Gateway/API Shield capabilities where applicable
- mTLS
- private-network/VPC connectivity where applicable
- redirects, transforms, origin/routing rules and related zone configuration

Do not alter DNS, certificates, access policy, firewall/security rules, or production routing without first resolving the exact intended production effect.

## Secrets and configuration
Use encrypted Worker secrets/Secrets Store for secret material. Use ordinary environment variables only for non-secret configuration. A secret's name may be documented; its value must not be.
Wrangler configuration is infrastructure configuration and should represent intended reproducible application requirements. Dashboard-only configuration must not silently conflict with repository configuration.
Use keep-vars behavior deliberately when dashboard variables must survive deployments.

## Deployments and infrastructure management
Cloudflare resources may be managed through:
- Cloudflare dashboard
- Wrangler
- Cloudflare REST API / official SDKs
- supported Infrastructure as Code, including Terraform
- repository/CI deployment workflows
- Deploy-to-Cloudflare flows where applicable

Repository-driven deployment should keep the authoritative source clear and avoid parallel sources of truth.
Automatic provisioning can create supported resources from Wrangler requirements in supported deployment flows.

## Observability and verification
Workers observability can include:
- Workers Logs
- real-time logs
- invocation/custom/error/exception logs
- metrics and analytics
- traces and automatic instrumentation
- Query Builder
- Tail Workers
- Workers Logpush
- OpenTelemetry export
- source maps/stack traces
- local observability/debugging

After deployment/configuration changes, agents should verify deployment status, route reachability, relevant logs/errors, bindings, expected runtime behavior, and security boundaries.

## Permissions model
Cloudflare API permissions are separated by resource scope:
- Account
- Zone
- User

Operations may require different permission groups even when performed by the same automation. DNS is zone-scoped; many Developer Platform resources are account-scoped. Token permission metadata should be checked against Cloudflare's current permission-groups API/docs before issuing or changing credentials.
For durable CI/service integrations, account-owned API tokens can be preferable to user-owned tokens when available and appropriate.
Never broaden a token merely to avoid determining the required permission.

## Development modes
Wrangler/local development can simulate many bindings locally and can connect selected bindings to remote resources. Support differs by binding and by local vs remote development. Agents must check the current binding-development support table before assuming a resource can be simulated or remotely bound.

## Interplanetary Fund decision rule
When implementing a feature:
1. Determine whether it belongs in static delivery, Worker compute/API, a Cloudflare binding/resource, Base44, or an external provider.
2. Prefer the simplest supported architecture that preserves security and the project's existing authoritative runtime.
3. Use bindings for Cloudflare resources from Workers where practical.
4. Use REST/API tokens for external automation or operations that cannot use bindings.
5. Do not replace the existing application with a starter/template merely to add one capability.
6. Verify both configuration and live behavior after implementation.

## Authoritative Cloudflare references
Agents should refresh knowledge from these official documentation areas before significant work:
- Workers overview: https://developers.cloudflare.com/workers/
- Worker bindings: https://developers.cloudflare.com/workers/runtime-apis/bindings/
- Storage selection: https://developers.cloudflare.com/workers/platform/storage-options/
- Observability: https://developers.cloudflare.com/workers/observability/
- Cloudflare API: https://developers.cloudflare.com/api/overview/
- API permissions: https://developers.cloudflare.com/fundamentals/api/reference/permissions/
- Infrastructure as Code: https://developers.cloudflare.com/workers/platform/infrastructure-as-code/

This file intentionally contains capability knowledge rather than secret/account-specific credential data.
