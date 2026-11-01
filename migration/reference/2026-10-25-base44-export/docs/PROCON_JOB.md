# The Procon Job (Pc Job)

The Pc Job is Interplanetary Fund's platform-connection specification.

## User contract
- A user chooses a platform and sees whether it is on and working.
- Provider-supported connections use a familiar plugin/connector flow: approve Interplanetary Fund, continue directly to the provider, authorize there, and return connected.
- OAuth/API/token mechanics stay out of normal-user UI.
- One provider connection is reusable by the user's authorized Interplanetary Fund agents and workflows; users are not asked to reconnect separately for every agent.
- Request the useful provider-supported capability envelope at authorization time. Requested, provider-reported, actually granted, and automation-authorized capabilities remain distinct.
- Unknown capability is never represented as granted. A newly required provider capability may require provider reauthorization.
- Connection state persists until user disconnect, provider expiration/revocation, or required reauthorization.
- Disconnect centrally removes OBO/agent/automation authority immediately and requests provider-side connector revocation when supported.

## Execution contract
- Raw OAuth credentials/tokens remain in protected backend/provider connector storage and are not exposed to agents or ordinary frontend state.
- Every external side effect rechecks ownership, connection health, OBO consent, shared-agent permission, provider capability, role, automation permission, and applicable global AI/financial authorization.
- Financial account connection/verification does not by itself prove financial custody, donation provenance, or withdrawable balance.
- Provider limitations are represented accurately rather than simulated.
- A connection can be healthy even when a particular provider action is unsupported; unsupported actions must not be advertised as active.

## Runtime compatibility
Pc Job must not narrow the project's runtime support. Interplanetary Fund deliberately retains Base44 Node 20 compatibility and Node 22 support. Node 24 is excluded. Do not hard-lock the platform to Node 22.

## Regression expectation
Connection catalog, connector lookup, OAuth finalization, verification, central revocation, and execution-time authorization must stay aligned for every provider added to the Pc Job.
