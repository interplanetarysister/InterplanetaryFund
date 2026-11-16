# Financial branch repair acceptance limits

Financial source repairs based on origin/main 20f98c4c. Pure synthetic tests run the entire actual Edge request handler with signed transport and HTTP database calls stubbed. Provider requests, actual charges, hosted Edge deployment, SQL application and merchant/payout flags were not changed.

The old preview/source-staged branch's 20261114_ifund_subscription_atomic_events_staged.sql has not been applied or wired here. Full subscription production readiness still requires a reviewed atomic RPC coupling provider-resource uniqueness, per-parent-capture refund ceilings, immutable owner/currency/environment identity, ledger effects and monotonic subscription-state transitions. Historical timestamp-based payment and webhook-based reversal operation keys must be reconciled before changing them; changing keys alone can duplicate historical economic events. Current Worker refunds remain fail-closed with subscription_refund_atomic_ledger_unavailable. These source guards do not certify atomic exactly-once economic handling.

Existing ledger rows lacking immutable provider resource provenance now fail reconciliation rather than being silently backfilled from later status refreshes. A normal refresh can reuse an existing fully matching receipt without inventing a sale ID. Historical null-reference rows need separate provider-backed reconciliation before claiming a verified active state.

The deployed Worker payment enablement/mode remain untouched. Do not claim live provider or deployed Edge acceptance from these tests.
