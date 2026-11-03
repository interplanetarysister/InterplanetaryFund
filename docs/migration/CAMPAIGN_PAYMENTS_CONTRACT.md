# Campaign donation UX and PayPal readiness contract

## Product behavior

- Every active campaign keeps a visible Donate action on desktop and mobile.
- The donation dialog accepts a campaign gift, optional 10% IFund support added on top, and a separate estimated PayPal processing amount.
- The donor's entered gift is never reduced by optional support or processing.
- The 7% IFund platform fee is not charged to the donor; it is deducted from the campaign owner's withdrawal. The fee must be calculated and enforced by the authorized server-side withdrawal ledger, never by the browser.
- Campaign totals use only verified captured gift cents. Optional support and processor fees are excluded.
- Payment success is shown only after the server confirms a canonical financial operation.

## Readiness contract

The UI enables PayPal only when GET /api/payments/capabilities returns all of:

- ready: true
- create_order: true
- capture_order: true
- client_id: a non-empty public PayPal client ID

A missing endpoint, non-200 response, missing capability, or malformed response leaves the full donation form visible but prevents payment initiation. The status shown in that case is transient and does not change the intended product design.

## Worker API contract to implement next

- POST /api/payments/paypal/create-order
  - Accept campaign_id, gift_amount, optional_support, and a stable intent_id.
  - Recalculate all money server-side; never trust browser totals or fees.
  - Verify active campaign, optional donor lifecycle, live PayPal merchant configuration, rate limits, and the explicit server-side checkout gate.
  - Create an idempotent PayPal order payable to the verified IFund business merchant.
  - Persist the pending intent before returning the order ID.

- POST /api/payments/paypal/capture-order
  - Accept only order_id and campaign_id.
  - Re-fetch and verify the PayPal order and completed capture server-to-server.
  - Verify USD currency, designated payee, order metadata, actual provider fee, and provider receivable.
  - Apply the donation, IFund support allocation, and holding-ledger entry atomically through a service-role-only database function.
  - Return success only after the canonical financial operation and ledger rows are durable.
  - Reconcile an already-completed provider capture idempotently; never create a second charge.

- POST /api/payments/paypal/webhook
  - Verify PayPal webhook signatures against the configured webhook ID.
  - Deduplicate provider event IDs and reconcile completed, refunded, and reversed events without trusting browser callbacks.

## Current gate

This UI change does not add or activate the Worker payment endpoints, apply the SQL migration, set PayPal secrets, or enable checkout. The capability endpoint is not yet present, so the dialog remains fail-closed. The Worker payment handlers, atomic ledger RPC, webhook reconciliation, merchant verification, and provider/browser validation remain separate required work.
