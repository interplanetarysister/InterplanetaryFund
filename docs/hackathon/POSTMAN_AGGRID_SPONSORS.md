# Sponsor tool integration: Postman + AG Grid Community

Included in the **existing** iFund application. No new backend, storage, payments, AI subscription or Base44 credits.

## AG Grid Community (MIT, free)
- Public judge demo: `/hackathon#finance-demo` shows **fictional, clearly labeled example rows** in a real AG Grid Community financial dashboard. Judges can filter, sort, paginate, rearrange columns and export an example CSV.
- Existing admin finance reporting page uses AG Grid for **actual verified Supabase RPC campaign summaries**. Original access controls, finance RPCs and receipts remain unchanged; no anonymous admin rows are fetched.
- Sample display figures are NOT payment captures, PayPal sandbox orders, confirmed donations, real campaign totals or withdrawable balances. Never treat them as provider evidence.
- Only `ag-grid-community` and `ag-grid-react` (Community) are required; no Enterprise licence or AG Studio purchase.

## Postman sandbox API checks
- Import `apps/web/docs/hackathon/postman/ifund-paypal-sandbox-readonly.postman_collection.json` into free Postman, or execute via the Postman Newman CLI.
- Collection makes four **GET-only** calls against `sandbox_origin`: sandbox status, redacted diagnostics, demo HTML, and negative method validation for orders (405).
- Default origin is a documented sandbox preview. Verify its deployment before execution.
- The collection never stores credentials, posts to Orders v2, captures payments or writes receipts.
- A successful run verifies read-only API contracts, **not** real PayPal sandbox buyer approval, capture, webhooks, AI results, or Devpost submission acceptance.
- Do not claim Postman was *used to test the deployed API* until an actual Postman/Newman run has been performed and its results checked.

## Verification and release
- `node --test tests/hackathon-sponsors.test.js` in `apps/web` checks example-only data, Postman schema, safe methods and sandbox URL.
- `npm ci --no-audit --no-fund && npm test && npm run build` in `apps/web` checks bundle compilation.
- Validate `/hackathon` on an actual Cloudflare preview deployment after the lockfile has been updated.
- Never copy fictional sample rows into Supabase donation tables or claim sponsor use has been confirmed via Devpost.
