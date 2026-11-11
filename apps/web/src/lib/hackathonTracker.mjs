export const FLOWS = [
  { id: "ai", label: "AI + campaign" },
  { id: "checkout", label: "REST sandbox checkout" },
  { id: "webhook", label: "Webhook security" },
  { id: "data", label: "Records + ledger" },
  { id: "release", label: "Judge + submission" },
];
export const STATUS = ["unknown", "pending", "blocked", "completed"];
export const STEPS = [
  { key: "ai-draft", flow: "ai", title: "Demonstrate real AI campaign drafting", check: "Show actual input and fresh provider-backed output; save and reopen a draft. Do not count a placeholder or canned example.", action: "/agents" },
  { key: "demo-campaign", flow: "ai", title: "Prepare authorized demo campaign", check: "Use a real published campaign or clearly labeled DEMO / NO REAL FUNDRAISING campaign and verify it is eligible for the sandbox checkout.", action: "/create" },
  { key: "sandbox-status", flow: "checkout", title: "Verify preview sandbox readiness", check: "On the exact preview origin, verify /api/paypal/sandbox/status returns application/json and explicit sandbox-only readiness; confirm live payments remain disabled.", action: "/api/paypal/sandbox/status" },
  { key: "orders-v2", flow: "checkout", title: "Create and approve sandbox REST order", check: "Confirm an Orders v2 order was created by PayPal sandbox and approved by a controlled sandbox buyer. Approval alone is not a donation.", action: "/hackathon" },
  { key: "capture-v2", flow: "checkout", title: "Capture and verify order with PayPal", check: "Confirm provider-backed capture ID, matching order, amount and successful isolated receipt persistence. Never mark complete on UI redirect alone.", action: "/hackathon" },
  { key: "webhook-delivery", flow: "webhook", title: "Prove webhook delivery", check: "Show that the registered sandbox webhook reached the deployed preview endpoint with event ID, timestamp, and provider delivery result. Redact private identifiers." },
  { key: "webhook-signature", flow: "webhook", title: "Verify signatures and reject tampering", check: "Record PayPal verify-webhook-signature success and a negative test where unsigned or modified payloads fail closed." },
  { key: "idempotent-events", flow: "webhook", title: "Demonstrate idempotent processing", check: "Repeat capture/event delivery and show no duplicate provider capture or persisted receipt/event records." },
  { key: "sandbox-records", flow: "data", title: "Confirm isolated sandbox receipt records", check: "Show exactly one captured record in ifund_paypal_sandbox_orders and corresponding signature-verified event in ifund_paypal_sandbox_events. Confirm browser roles cannot read these tables." },
  { key: "ledger-isolation", flow: "data", title: "Verify ledger visibility and isolation", check: "Compare authorized finance/ledger views and database counts before/after test. Sandbox receipts must NOT create real donations, ledger credits, withdrawals or public totals.", action: "/ledger" },
  { key: "campaign-display", flow: "data", title: "Verify campaign donation display", check: "Open the chosen campaign and confirm its donation button, visible totals, and history are truthful. Do not attribute sandbox money to actual donors.", action: "/discover" },
  { key: "preview-provenance", flow: "release", title: "Confirm preview route, commit and deployment", check: "Attach exact HTTPS preview /hackathon URL, source commit SHA and Cloudflare successful deployment, plus runtime route/function smoke evidence." },
  { key: "judge-access", flow: "release", title: "Verify safe judge access and walkthrough", check: "Test the demo on phone and desktop. Distribute disposable buyer credentials privately, never in the tracker or screenshots." },
  { key: "judge-instructions", flow: "release", title: "Review judge testing instructions", check: "Provide reproducible steps for AI, sandbox authorization, capture, webhook, receipt and negative tests; distinguish verified results from unknowns." },
  { key: "submission-assets", flow: "release", title: "Verify video, description and links", check: "Check public video is under three minutes, English description is accurate, and source, demo and evidence URLs resolve." },
  { key: "devpost-receipt", flow: "release", title: "Confirm final Devpost submission receipt", check: "Attach evidence of the final submission or update before November 12, 2026 at noon Pacific. Do not infer success from an earlier draft." },
];
export const blankRecord = (key) => ({
  step_key: key, status: "unknown", evidence_links: [], screenshot_links: [],
  test_result: "", blocker: "", next_action: "", commit_sha: "", preview_url: "",
  deployment_notes: "", checked_at: null, updated_at: null, revision: 0,
});
export const recordFor = (step, persisted = {}) => ({ ...blankRecord(step.key), ...persisted });
export function parseLinks(value) {
  const links = String(value || "").split(/\r?\n/).map(x => x.trim()).filter(Boolean);
  if (links.length > 12) throw Error("Maximum 12 links per field.");
  for (const link of links) {
    try { if (new URL(link).protocol !== "https:") throw Error(); }
    catch { throw Error("Evidence and screenshot links must be complete HTTPS URLs."); }
  }
  return [...new Set(links)];
}
export function validateRecord(record) {
  if (!STATUS.includes(record.status)) return "Choose a valid status.";
  if (record.commit_sha && !/^[a-f0-9]{7,40}$/.test(record.commit_sha)) return "Use a 7–40 character lowercase Git commit SHA.";
  if (record.preview_url) {
    try { if (new URL(record.preview_url).protocol !== "https:") throw Error(); }
    catch { return "Preview URL must use HTTPS."; }
  }
  if (record.status === "completed" && (!record.evidence_links.length || !record.test_result.trim()))
    return "Completed steps require at least one evidence link and a documented test result. A manual status is not automatic provider verification.";
  return "";
}
export function readiness(records) {
  const rows = STEPS.map(step => ({ ...step, record: recordFor(step, records[step.key]) }));
  const counts = Object.fromEntries(STATUS.map(status => [status, rows.filter(x => x.record.status === status).length]));
  const open = rows.filter(x => x.record.status !== "completed");
  return { rows, counts, open, reviewed: open.length === 0 };
}
export function makeReport(records, generatedAt = new Date().toISOString()) {
  const { rows, counts, reviewed } = readiness(records);
  const lines = [
    "# iFund PayPal Hackathon — manual submission-readiness report",
    "Generated: " + generatedAt,
    "Result: " + (reviewed ? "ALL CHECKS REPORTED COMPLETE — still requires independent provider/deployment review" : "NOT READY — outstanding demo checks"),
    "Manual status: " + counts.completed + "/" + rows.length + " completed; " + counts.pending + " pending; " + counts.blocked + " blocked; " + counts.unknown + " unknown.",
    "Scope: existing Cloudflare Pages/Workers + Supabase + PayPal SANDBOX; no live payment activation or Base44 cutover.",
    "Note: these are organizer-entered records, not automatically provider-verified results.",
    "", "## Checks",
  ];
  for (const { key, title, record } of rows) {
    lines.push("- [" + record.status.toUpperCase() + "] " + title + " (" + key + ")");
    if (record.test_result.trim()) lines.push("  Test: " + record.test_result.trim().replace(/\s+/g, " ").slice(0, 500));
    if (record.blocker.trim()) lines.push("  Blocker: " + record.blocker.trim().replace(/\s+/g, " ").slice(0, 400));
    if (record.next_action.trim()) lines.push("  Next: " + record.next_action.trim().replace(/\s+/g, " ").slice(0, 400));
    if (record.evidence_links.length) lines.push("  Evidence: " + record.evidence_links.join(", "));
    if (record.screenshot_links.length) lines.push("  Screenshots: " + record.screenshot_links.join(", "));
    if (record.deployment_notes) lines.push("  Deployment: " + record.deployment_notes.trim().replace(/\\s+/g, " ").slice(0, 450));
    if (record.preview_url) lines.push("  Preview: " + record.preview_url);
    if (record.commit_sha) lines.push("  Commit: " + record.commit_sha);
  }
  lines.push("", "Never interpret sandbox receipts as real donations or withdrawal authority.");
  return lines.join("\n");
}
