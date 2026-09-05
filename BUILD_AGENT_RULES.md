# Build & Builder Instructions — NO GUESSING

## NON-NEGOTIABLE

**NEVER GUESS.** If a fact is required to make a build decision and it is not verified, stop and verify it before changing code.

Do not infer repository purpose, architecture, ownership, dependencies, deployment targets, data sources, credentials, API contracts, feature status, or prior decisions from filenames, assumptions, memory fragments, or stale documentation.

## Evidence hierarchy

Use this order when resolving facts:

1. Explicit current project architecture/decision records.
2. Verified source code, schemas, configuration, deployment configuration, and tests.
3. Current repository/build-agent instructions.
4. Current connected platform state.
5. Historical documentation.
6. Never use unsupported inference as a fact.

If sources conflict, **do not choose silently**. Identify the conflict, verify the authoritative source, then proceed.

## Existing knowledge must be preserved

Do not repeatedly rediscover or overwrite established project knowledge. Treat the current architecture and capability registry as persistent state. When new evidence changes a fact, update the authoritative record and propagate the correction to affected build instructions.

## Before every build

1. Identify the repository and its exact purpose.
2. Identify the affected capability.
3. Identify the canonical owner of its live data.
4. Identify all affected repositories/services/agents.
5. Verify the existing implementation before modifying it.
6. Check whether an equivalent capability already exists elsewhere.
7. Check dependencies, contracts, permissions, environment configuration, and deployment relationships.
8. Only then implement.

## Cross-repository rule

All Interplanetary Fund repositories are components of **one cohesive product**. Never implement a competing product, database, campaign store, or business source of truth.

A campaign created or changed anywhere must resolve to the same canonical campaign identity and live backend state wherever that surface is authorized to consume it.

## Unknowns

If something cannot be verified with available repository/project evidence, mark it **UNKNOWN**. Do not invent an answer. Ask for clarification only when verification cannot resolve the issue and the decision is material.

## Completion rule

Never report a feature as complete merely because code was written or pushed. Verify the relevant end-to-end behavior and state what was actually verified versus what remains unverified.
