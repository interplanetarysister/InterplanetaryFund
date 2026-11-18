import { createClient } from "npm:@supabase/supabase-js@2.105.4";

const corsHeaders = {
  "content-type": "application/json",
  "cache-control": "no-store",
  "access-control-allow-methods": "GET, POST, OPTIONS",
  "access-control-allow-headers": "authorization, apikey, content-type, x-client-info",
};
const allowedOrigins = new Set([
  "https://interplanetaryfund.com",
  "https://www.interplanetaryfund.com",
  "https://preview.interplanetaryfund.com",
  "https://interplanetaryfund-migration.pages.dev",
  "https://preview.interplanetaryfund-migration.pages.dev",
  "https://feature-connections-icon-hub.interplanetaryfund-migration.pages.dev",
  "capacitor://localhost",
  "http://localhost:5173",
  "http://127.0.0.1:5173",
]);
const VERSION = "ifund-external-creator-full-control-v2";
const AUTHORIZATION_TEXT = `You authorize the named IFund admin account assigned to this mandate to receive full operational control of the specific fundraiser identified in this authorization for the mandate term. You also grant every AI feature and AI agent available to that assigned admin account unlimited permission in scope to access and use the information supplied for this fundraiser and to perform all available campaign-related AI work on your behalf, including research, planning, drafting, editing, design, media generation, optimization, scheduling, coordination, analytics, and management, without a feature-specific or task-count restriction imposed by this mandate. This unlimited permission is limited to the identified fundraiser; it does not grant access to unrelated personal data, unrelated campaigns, credentials, or accounts. Actual usage remains subject to the assigned admin account subscription and usage entitlements, provider/API capability and capacity, platform rules, applicable law, security controls, and safety restrictions; it does not promise unlimited compute, free usage, or the ability to bypass those controls. Publishing, external posting/outreach, donor messaging, account connections, financial/payout actions, and payout-destination changes each require separate affirmative authorization. Your authorization expires on the stated date and may be revoked through the creator review link or by contacting IFund. IFund will not create an IFund login for you or impersonate you. The campaign will identify you as the creator/beneficiary and disclose IFund's management. No campaign will be published or donations solicited until identity/authority checks, final creator content approval, payout verification, legal/platform checks, and any separately required permissions are complete.`;
const json = (status, body, origin) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, ...(origin && allowedOrigins.has(origin) ? { "access-control-allow-origin": origin, vary: "Origin" } : {}) },
});
const clean = (value, max = 500) => typeof value === "string" ? value.trim().replace(/[\u0000-\u001f\u007f]/g, " ").slice(0, max) : "";
const token = () => {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
};
const hash = async (value) => {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(bytes), (b) => b.toString(16).padStart(2, "0")).join("");
};
const safeUrl = (value) => {
  try {
    const u = new URL(value);
    const host = u.hostname.toLowerCase().replace(/^\\[|\\]$/g, "");
    const privateHost = host === "localhost" || host.endsWith(".localhost") || host === "::1" ||
      host === "0.0.0.0" || /^127\\./.test(host) || /^10\\./.test(host) ||
      /^192\\.168\\./.test(host) || /^169\\.254\\./.test(host) ||
      /^172\\.(1[6-9]|2[0-9]|3[01])\\./.test(host);
    return u.protocol === "https:" && !u.username && !u.password && !privateHost;
  } catch { return false; }
};
const event = async (db, mandateId, actorKind, actorId, eventType, details = {}) => {
  const { error } = await db.from("ifund_creator_mandate_events").insert({
    mandate_id: mandateId, actor_kind: actorKind, actor_user_id: actorId || null, event_type: eventType, details,
  });
  if (error) throw error;
};
const adminContext = async (req, env) => {
  const authorization = req.headers.get("authorization") || "";
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  if (!match) throw Object.assign(new Error("Verified administrator sign-in required."), { status: 401 });
  const url = env.SUPABASE_URL;
  const anon = env.SUPABASE_ANON_KEY || env.SUPABASE_PUBLISHABLE_KEY;
  const secret = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SECRET_KEY;
  if (!url || !secret || !anon) throw Object.assign(new Error("Managed mandate service is not configured."), { status: 503 });
  const userClient = createClient(url, anon, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: authorization } },
  });
  const { data: userData, error: userError } = await userClient.auth.getUser(match[1]);
  if (userError || !userData?.user || userData.user.is_anonymous || !userData.user.email_confirmed_at) {
    throw Object.assign(new Error("A confirmed IFund administrator session is required."), { status: 401 });
  }
  const { data: verified, error: verifyError } = await userClient.rpc("ifund_current_user_is_verified_super_admin");
  if (verifyError || verified !== true) throw Object.assign(new Error("Verified IFund super-administrator access required."), { status: 403 });
  return {
    user: userData.user,
    userClient,
    db: createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } }),
  };
};
const consentPacket = (row) => ({
  id: row.id,
  creatorName: row.creator_name,
  creatorEmail: row.creator_email.replace(/^(.).+(@.+)$/, "$1••••$2"),
  fundraiserUrl: row.fundraiser_url,
  fundraiserLabel: row.fundraiser_label,
  beneficiaryName: row.beneficiary_name,
  assignedAdminId: row.assigned_admin_id,
  authorizationVersion: row.authorization_version,
  authorizationText: row.authorization_text,
  expiresAt: row.expires_at,
  requiredAcknowledgements: {
    fullControl: true,
    allAiFeatures: true,
    creatorAuthority: true,
  },
  separateScopes: ["publish","external_outreach","donor_messaging","account_connections","financial_actions","payout_changes"],
});
Deno.serve(async (req) => {
  const origin = req.headers.get("origin") || "";
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: { ...corsHeaders, ...(allowedOrigins.has(origin) ? { "access-control-allow-origin": origin, vary: "Origin" } : {}) } });
  if (origin && !allowedOrigins.has(origin)) return json(403, { error: "origin_not_allowed" });
  if (!["GET","POST"].includes(req.method)) return json(405, { error: "method_not_allowed" }, origin);
  const url = new URL(req.url);
  const action = url.searchParams.get("action") || "";
  try {
    const rawBody = req.method === "POST" ? await req.text() : "";
    if (new TextEncoder().encode(rawBody).byteLength > 100_000) return json(413, { error: "request_too_large" }, origin);
    let body = {};
    if (rawBody) { try { body = JSON.parse(rawBody); } catch { return json(400, { error: "invalid_json" }, origin); } }
    if (!body || typeof body !== "object" || Array.isArray(body)) return json(400, { error: "invalid_request_body" }, origin);
    const publicToken = clean(url.searchParams.get("token") || body.token, 128);
    const serviceUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("SUPABASE_SECRET_KEY");
    if (!serviceUrl || !serviceKey) throw Object.assign(new Error("Managed mandate service is not configured."), { status: 503 });
    const publicDb = createClient(serviceUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

    if (action === "consent" && req.method === "GET") {
      if (!/^[a-f0-9]{64}$/.test(publicToken)) return json(404, { error: "invitation_not_found" }, origin);
      const { data: row, error } = await publicDb.from("ifund_creator_mandates").select("*")
        .eq("consent_token_hash", await hash(publicToken)).eq("status", "invited").gt("expires_at", new Date().toISOString()).maybeSingle();
      if (error || !row) return json(404, { error: "invitation_expired_or_unavailable" }, origin);
      return json(200, { mandate: consentPacket(row) }, origin);
    }

    if (action === "decline" && req.method === "POST") {
      if (!/^[a-f0-9]{64}$/.test(publicToken)) return json(404, { error: "invitation_not_found" }, origin);
      const { data: row, error } = await publicDb.from("ifund_creator_mandates").select("id")
        .eq("consent_token_hash", await hash(publicToken)).eq("status", "invited").gt("expires_at", new Date().toISOString()).maybeSingle();
      if (error || !row) return json(404, { error: "invitation_expired_or_unavailable" }, origin);
      const { error: updateError } = await publicDb.from("ifund_creator_mandates").update({
        status: "declined", consent_token_hash: null, updated_at: new Date().toISOString(),
      }).eq("id", row.id).eq("status", "invited");
      if (updateError) throw updateError;
      await event(publicDb, row.id, "creator", null, "declined");
      return json(200, { declined: true }, origin);
    }

    if (action === "accept" && req.method === "POST") {
      if (!/^[a-f0-9]{64}$/.test(publicToken)) return json(404, { error: "invitation_not_found" }, origin);
      const { data: row, error } = await publicDb.from("ifund_creator_mandates").select("*")
        .eq("consent_token_hash", await hash(publicToken)).eq("status", "invited").gt("expires_at", new Date().toISOString()).maybeSingle();
      if (error || !row) return json(404, { error: "invitation_expired_or_unavailable" }, origin);
      const creatorName = clean(body.creator_name, 120);
      const creatorEmail = clean(body.creator_email, 320).toLowerCase();
      if (!creatorName || creatorName.length < 2 || creatorEmail !== row.creator_email.toLowerCase() ||
          body.full_control_acknowledged !== true || body.ai_all_features_acknowledged !== true ||
          body.creator_authority_confirmed !== true || body.accepted_terms !== true) {
        return json(422, { error: "all_required_authorizations_must_be_confirmed" }, origin);
      }
      const scopeKeys = ["publish","external_outreach","donor_messaging","account_connections","financial_actions","payout_changes"];
      const scopes = Object.fromEntries(scopeKeys.map((key) => [key, body.scopes?.[key] === true]));
      const { data: updated, error: updateError } = await publicDb.from("ifund_creator_mandates").update({
        creator_name: creatorName,
        status: "consented_pending_verification",
        consent_token_hash: null,
        full_control_acknowledged: true,
        ai_all_features_acknowledged: true,
        creator_authority_confirmed: true,
        consented_at: new Date().toISOString(),
        scopes,
        updated_at: new Date().toISOString(),
      }).eq("id", row.id).eq("status", "invited").select("id").maybeSingle();
      if (updateError || !updated) throw updateError || new Error("Invitation was already used.");
      await event(publicDb, row.id, "creator", null, "consented", { authorization_version: row.authorization_version, scopes });
      return json(200, { accepted: true, status: "consented_pending_verification", message: "Your authorization has been recorded. IFund must complete identity and authority verification before managed campaign work begins." }, origin);
    }

    if (action === "review" && req.method === "GET") {
      if (!/^[a-f0-9]{64}$/.test(publicToken)) return json(404, { error: "review_link_unavailable" }, origin);
      const { data: row, error } = await publicDb.from("ifund_creator_mandates").select("id,creator_name,fundraiser_label,fundraiser_url,beneficiary_name,assigned_admin_id,authorization_version,expires_at,status,draft_payload,creator_review_state")
        .eq("review_token_hash", await hash(publicToken)).eq("status", "active").gt("expires_at", new Date().toISOString()).maybeSingle();
      if (error || !row || !row.draft_payload) return json(404, { error: "review_link_unavailable" }, origin);
      return json(200, { mandate: row }, origin);
    }

    if (action === "review" && req.method === "POST") {
      if (!/^[a-f0-9]{64}$/.test(publicToken)) return json(404, { error: "review_link_unavailable" }, origin);
      const { data: row, error } = await publicDb.from("ifund_creator_mandates").select("id,status,expires_at,creator_review_state")
        .eq("review_token_hash", await hash(publicToken)).eq("status", "active").gt("expires_at", new Date().toISOString()).maybeSingle();
      if (error || !row) return json(404, { error: "review_link_unavailable" }, origin);
      const decision = clean(body.decision, 40);
      if (!["approved","changes_requested","revoked"].includes(decision)) return json(422, { error: "invalid_review_decision" }, origin);
      const feedback = clean(body.feedback, 4000);
      if (decision === "changes_requested" && feedback.length < 10) return json(422, { error: "specific_feedback_required" }, origin);
      const update = decision === "revoked"
        ? { status: "revoked", revoked_at: new Date().toISOString(), revoked_reason: "Creator revoked through secure review link.", consent_token_hash: null, review_token_hash: null, updated_at: new Date().toISOString() }
        : { creator_review_state: decision, creator_feedback: feedback || null, creator_approved_at: decision === "approved" ? new Date().toISOString() : null, updated_at: new Date().toISOString() };
      const { error: updateError } = await publicDb.from("ifund_creator_mandates").update(update).eq("id", row.id).eq("status", "active");
      if (updateError) throw updateError;
      const eventType = decision === "approved" ? "creator_approved" : decision === "changes_requested" ? "creator_requested_changes" : "revoked";
      await event(publicDb, row.id, "creator", null, eventType, decision === "changes_requested" ? { feedback } : {});
      return json(200, { recorded: true, decision }, origin);
    }

    if (action === "external_destination_approve" && req.method === "GET") {
      if (!/^[a-f0-9]{64}$/.test(publicToken)) return json(404, { error: "destination_review_unavailable" }, origin);
      const { data: destination, error } = await publicDb.from("ifund_managed_external_destinations")
        .select("id,provider_label,donation_url,destination_owner_name,destination_owner_relationship,status,created_at")
        .eq("creator_approval_token_hash", await hash(publicToken))
        .eq("status", "pending_creator_approval").maybeSingle();
      if (error || !destination) return json(404, { error: "destination_review_unavailable" }, origin);
      const { data: mandate, error: mandateError } = await publicDb.from("ifund_creator_mandates")
        .select("status,expires_at,scopes").eq("id", destination.mandate_id).maybeSingle();
      if (mandateError || !mandate || mandate.status !== "active" ||
          new Date(mandate.expires_at).getTime() <= Date.now() || mandate.scopes?.publish !== true)
        return json(410, { error: "creator_authorization_expired_or_revoked" }, origin);
      return json(200, { destination }, origin);
    }

    if (action === "external_destination_approve" && req.method === "POST") {
      if (!/^[a-f0-9]{64}$/.test(publicToken) || body.approve !== true)
        return json(422, { error: "explicit_destination_approval_required" }, origin);
      const tokenHash = await hash(publicToken);
      const { data: destination, error } = await publicDb.from("ifund_managed_external_destinations")
        .select("id,mandate_id,donation_url,status")
        .eq("creator_approval_token_hash", tokenHash).eq("status", "pending_creator_approval").maybeSingle();
      if (error || !destination) return json(404, { error: "destination_review_unavailable" }, origin);
      const { data: mandate, error: mandateError } = await publicDb.from("ifund_creator_mandates")
        .select("status,expires_at,scopes").eq("id", destination.mandate_id).maybeSingle();
      if (mandateError || !mandate || mandate.status !== "active" ||
          new Date(mandate.expires_at).getTime() <= Date.now() || mandate.scopes?.publish !== true)
        return json(410, { error: "creator_authorization_expired_or_revoked" }, origin);
      const { data: updated, error: updateError } = await publicDb.from("ifund_managed_external_destinations").update({
        creator_approved_at: new Date().toISOString(),
        creator_approved_url_sha256: await hash(destination.donation_url),
        creator_approved_by_token: true,
        creator_approval_token_hash: null,
        status: "pending_provider_verification",
        updated_at: new Date().toISOString(),
      }).eq("id", destination.id).eq("creator_approval_token_hash", tokenHash)
        .eq("status", "pending_creator_approval").select("id").maybeSingle();
      if (updateError || !updated) throw updateError || new Error("Destination approval was already used.");
      await event(publicDb, destination.mandate_id, "creator", null, "external_destination_creator_approved", {
        destination_id: destination.id, donation_url_sha256: await hash(destination.donation_url),
      });
      return json(200, { approved: true, status: "pending_provider_verification" }, origin);
    }

    if (!["POST","GET"].includes(req.method)) return json(405, { error: "method_not_allowed" }, origin);
    const { user, userClient, db } = await adminContext(req, {
      SUPABASE_URL: Deno.env.get("SUPABASE_URL") || "",
      SUPABASE_ANON_KEY: Deno.env.get("SUPABASE_ANON_KEY") || "",
      SUPABASE_PUBLISHABLE_KEY: Deno.env.get("SUPABASE_PUBLISHABLE_KEY") || "",
      SUPABASE_SERVICE_ROLE_KEY: Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "",
      SUPABASE_SECRET_KEY: Deno.env.get("SUPABASE_SECRET_KEY") || "",
    });
    if (action === "create_external_destination" && req.method === "POST") {
      const mandateId = clean(body.mandate_id, 64);
      const providerLabel = clean(body.provider_label, 100);
      const donationUrl = clean(body.donation_url, 2048);
      const ownerName = clean(body.destination_owner_name, 180);
      const ownerRelationship = clean(body.destination_owner_relationship, 500);
      if (!/^[0-9a-f-]{36}$/i.test(mandateId) || providerLabel.length < 2 || !safeUrl(donationUrl) ||
          ownerName.length < 2 || ownerRelationship.length < 2)
        return json(422, { error: "valid_provider_destination_and_owner_details_required" }, origin);
      const { data: mandate, error: mandateError } = await db.from("ifund_creator_mandates")
        .select("id,assigned_admin_id,status,expires_at,scopes,campaign_id,creator_review_state")
        .eq("id", mandateId).eq("assigned_admin_id", user.id).eq("status", "active")
        .gt("expires_at", new Date().toISOString()).maybeSingle();
      if (mandateError || !mandate) return json(404, { error: "active_assigned_mandate_required" }, origin);
      if (mandate.scopes?.publish !== true || !mandate.campaign_id || mandate.creator_review_state !== "approved")
        return json(403, { error: "creator_publish_scope_approval_and_linked_campaign_required" }, origin);
      const approvalToken = token();
      const { data: destination, error } = await db.from("ifund_managed_external_destinations").insert({
        mandate_id: mandate.id, campaign_id: mandate.campaign_id, provider_label: providerLabel,
        donation_url: donationUrl, destination_owner_name: ownerName,
        destination_owner_relationship: ownerRelationship,
        creator_approval_token_hash: await hash(approvalToken),
        status: "pending_creator_approval", created_by_admin: user.id,
      }).select("id,status").single();
      if (error) throw error;
      await event(db, mandate.id, "admin", user.id, "external_destination_requested", {
        destination_id: destination.id, donation_url_sha256: await hash(donationUrl), provider_label: providerLabel,
      });
      return json(201, { destination_id: destination.id, status: destination.status,
        creator_approval_url: `https://interplanetaryfund.com/creator-review?external_destination_token=${approvalToken}`,
        delivery_note: "Send this one-time link only to the creator through the verified contact channel. The link does not verify provider ownership." }, origin);
    }
    if (action === "list_external_destinations" && req.method === "GET") {
      const mandateId = clean(url.searchParams.get("mandate_id"), 64);
      if (!/^[0-9a-f-]{36}$/i.test(mandateId)) return json(422, { error: "valid_mandate_required" }, origin);
      const { data: mandate, error: mandateError } = await db.from("ifund_creator_mandates")
        .select("id").eq("id", mandateId).eq("assigned_admin_id", user.id).maybeSingle();
      if (mandateError || !mandate) return json(404, { error: "assigned_mandate_not_found" }, origin);
      const { data, error } = await db.from("ifund_managed_external_destinations")
        .select("id,mandate_id,campaign_id,provider_label,donation_url,destination_owner_name,destination_owner_relationship,status,creator_approved_at,provider_owner_verified_at,compliance_checked_at,created_at,updated_at")
        .eq("mandate_id", mandateId).order("created_at", { ascending: false });
      if (error) throw error;
      return json(200, { destinations: data || [] }, origin);
    }
    if (action === "verify_external_destination" && req.method === "POST") {
      const destinationId = clean(body.destination_id, 64);
      const evidence = clean(body.provider_verification_evidence, 2000);
      if (!/^[0-9a-f-]{36}$/i.test(destinationId) || evidence.length < 30)
        return json(422, { error: "provider_verification_evidence_required" }, origin);
      const { data: destination, error: lookupError } = await db.from("ifund_managed_external_destinations")
        .select("id,mandate_id,status").eq("id", destinationId).eq("status", "pending_provider_verification").maybeSingle();
      if (lookupError || !destination) return json(404, { error: "destination_not_ready_for_provider_verification" }, origin);
      const { data: mandate, error: mandateError } = await db.from("ifund_creator_mandates")
        .select("id").eq("id", destination.mandate_id).eq("assigned_admin_id", user.id).maybeSingle();
      if (mandateError || !mandate) return json(404, { error: "assigned_mandate_not_found" }, origin);
      const { data: activeMandate, error: activeError } = await db.from("ifund_creator_mandates")
        .select("status,expires_at,scopes").eq("id", destination.mandate_id).maybeSingle();
      if (activeError || !activeMandate || activeMandate.status !== "active" ||
          new Date(activeMandate.expires_at).getTime() <= Date.now() || activeMandate.scopes?.publish !== true)
        return json(403, { error: "active_creator_publish_authorization_required" }, origin);
      const { error } = await db.from("ifund_managed_external_destinations").update({
        provider_owner_verified_at: new Date().toISOString(), provider_owner_verified_by: user.id,
        provider_verification_evidence: evidence, status: "pending_compliance", updated_at: new Date().toISOString(),
      }).eq("id", destination.id).eq("status", "pending_provider_verification");
      if (error) throw error;
      await event(db, destination.mandate_id, "admin", user.id, "external_destination_verified", { destination_id: destination.id });
      return json(200, { verified: true, status: "pending_compliance" }, origin);
    }
    if (action === "check_external_destination_compliance" && req.method === "POST") {
      const destinationId = clean(body.destination_id, 64);
      const evidence = clean(body.compliance_evidence, 2000);
      if (!/^[0-9a-f-]{36}$/i.test(destinationId) || evidence.length < 30)
        return json(422, { error: "compliance_evidence_required" }, origin);
      const { data: destination, error: lookupError } = await db.from("ifund_managed_external_destinations")
        .select("id,mandate_id,campaign_id,donation_url,creator_approved_url_sha256,status")
        .eq("id", destinationId).eq("status", "pending_compliance").maybeSingle();
      if (lookupError || !destination) return json(404, { error: "destination_not_ready_for_compliance" }, origin);
      if (destination.creator_approved_url_sha256 !== await hash(destination.donation_url))
        return json(409, { error: "creator_approved_url_changed" }, origin);
      const { data: mandate, error: mandateError } = await db.from("ifund_creator_mandates")
        .select("id,scopes,campaign_id,creator_review_state").eq("id", destination.mandate_id)
        .eq("assigned_admin_id", user.id).eq("status", "active").gt("expires_at", new Date().toISOString()).maybeSingle();
      if (mandateError || !mandate || mandate.scopes?.publish !== true ||
          mandate.campaign_id !== destination.campaign_id || mandate.creator_review_state !== "approved")
        return json(403, { error: "active_creator_publish_approval_required" }, origin);
      const { error } = await db.from("ifund_managed_external_destinations").update({
        compliance_checked_at: new Date().toISOString(), compliance_checked_by: user.id,
        compliance_evidence: evidence, status: "ready", updated_at: new Date().toISOString(),
      }).eq("id", destination.id).eq("status", "pending_compliance");
      if (error) throw error;
      await event(db, destination.mandate_id, "admin", user.id, "external_destination_compliance_checked", { destination_id: destination.id });
      return json(200, { checked: true, status: "ready", publication_enabled: false }, origin);
    }

    if (action === "list" && req.method === "GET") {
      const { data, error } = await db.from("ifund_creator_mandates").select("id,creator_name,creator_email,fundraiser_url,fundraiser_label,beneficiary_name,status,scopes,expires_at,identity_verified_at,identity_evidence_note,creator_review_state,creator_feedback,creator_approved_at,campaign_id,draft_payload,created_at,updated_at")
        .or(`assigned_admin_id.eq.${user.id},created_by_admin.eq.${user.id}`).order("created_at", { ascending: false }).limit(100);
      if (error) throw error;
      return json(200, { mandates: data || [] }, origin);
    }
    if (action === "create" && req.method === "POST") {
      const creatorName = clean(body.creator_name, 120);
      const creatorEmail = clean(body.creator_email, 320).toLowerCase();
      const fundraiserUrl = clean(body.fundraiser_url, 2000);
      const fundraiserLabel = clean(body.fundraiser_label, 180);
      const beneficiaryName = clean(body.beneficiary_name, 180);
      const days = Number(body.expires_in_days || 30);
      if (creatorName.length < 2 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(creatorEmail) ||
          !safeUrl(fundraiserUrl) || fundraiserLabel.length < 3 || beneficiaryName.length < 2 ||
          !Number.isInteger(days) || days < 1 || days > 90) return json(422, { error: "invalid_invitation_details" }, origin);
      const inviteToken = token();
      const authorizationSha = await hash(AUTHORIZATION_TEXT);
      const expiresAt = new Date(Date.now() + days * 86400000).toISOString();
      const { data: row, error } = await db.from("ifund_creator_mandates").insert({
        created_by_admin: user.id, assigned_admin_id: user.id, creator_name: creatorName, creator_email: creatorEmail,
        fundraiser_url: fundraiserUrl, fundraiser_label: fundraiserLabel, beneficiary_name: beneficiaryName,
        status: "invited", consent_token_hash: await hash(inviteToken), authorization_version: VERSION,
        authorization_text: AUTHORIZATION_TEXT, authorization_sha256: authorizationSha,
        expires_at: expiresAt,
      }).select("id,expires_at").single();
      if (error) throw error;
      await event(db, row.id, "admin", user.id, "invited", { assigned_admin_id: user.id, authorization_version: VERSION });
      return json(201, { mandate_id: row.id, consent_url: `https://interplanetaryfund.com/creator-authorization?token=${inviteToken}`, expires_at: row.expires_at, assigned_admin_id: user.id, delivery_note: "Send this one-time link only to the creator's invited email address. The link is not proof of identity by itself; identity and authority must still be verified by IFund." }, origin);
    }
    if (action === "link_campaign" && req.method === "POST") {
      const mandateId = clean(body.mandate_id, 64);
      const campaignId = clean(body.campaign_id, 64);
      if (!/^[0-9a-f-]{36}$/i.test(mandateId) || !/^[0-9a-f-]{36}$/i.test(campaignId))
        return json(422, { error: "valid_mandate_and_campaign_required" }, origin);
      const { data, error } = await userClient.rpc("ifund_creator_mandate_link_campaign", {
        p_mandate_id: mandateId,
        p_campaign_id: campaignId,
      });
      if (error) throw error;
      if (!data || data.linked !== true || data.campaign_id !== campaignId)
        throw new Error("The managed campaign link could not be confirmed.");
      return json(200, data, origin);
    }
    if (action === "sync_campaign" && req.method === "POST") {
      const mandateId = clean(body.mandate_id, 64);
      if (!/^[0-9a-f-]{36}$/i.test(mandateId))
        return json(422, { error: "valid_mandate_required" }, origin);
      const { data, error } = await userClient.rpc("ifund_creator_mandate_sync_campaign_draft", {
        p_mandate_id: mandateId,
      });
      if (error) throw error;
      if (!data || data.synced !== true || !data.campaign_id)
        throw new Error("The creator-approved campaign revision could not be confirmed.");
      return json(200, data, origin);
    }
    if (action === "verify_identity" && req.method === "POST") {
      const mandateId = clean(body.mandate_id, 64);
      const evidence = clean(body.identity_evidence_note, 2000);
      if (!/^[0-9a-f-]{36}$/i.test(mandateId) || evidence.length < 30) return json(422, { error: "identity_evidence_required" }, origin);
      const reviewToken = token();
      const { data: row, error } = await db.from("ifund_creator_mandates").update({
        status: "active", identity_verified_at: new Date().toISOString(), identity_verified_by: user.id,
        identity_evidence_note: evidence, review_token_hash: await hash(reviewToken), updated_at: new Date().toISOString(),
      }).eq("id", mandateId).eq("assigned_admin_id", user.id).eq("status", "consented_pending_verification").gt("expires_at", new Date().toISOString())
        .select("id,expires_at").maybeSingle();
      if (error || !row) throw error || new Error("Consented mandate not found or not assigned to this admin.");
      await event(db, row.id, "admin", user.id, "identity_verified", { evidence_note_recorded: true });
      return json(200, { verified: true, mandate_id: row.id, review_token: reviewToken, expires_at: row.expires_at, warning: "Record only evidence actually checked. Send the review link after a draft is prepared." }, origin);
    }
    if (action === "save_draft" && req.method === "POST") {
      const mandateId = clean(body.mandate_id, 64);
      const draft = body.draft;
      if (!/^[0-9a-f-]{36}$/i.test(mandateId) || !draft || typeof draft !== "object" || Array.isArray(draft)) return json(422, { error: "valid_draft_required" }, origin);
      const serialized = JSON.stringify(draft);
      const goalText = String(draft.goal_amount ?? "");
      const allowedCategories = new Set(["medical","emergency","education","community","animals","business","memorial","disaster_relief","creative","environment","other"]);
      if (serialized.length > 80_000 ||
          !clean(draft.title, 150) ||
          !clean(draft.summary, 600) ||
          !clean(draft.story, 15_000) ||
          !allowedCategories.has(clean(draft.category, 40)) ||
          !/^\d{1,9}(?:\.\d{1,2})?$/.test(goalText) ||
          !Number.isFinite(Number(goalText)) || Number(goalText) <= 0) {
        return json(422, { error: "draft_requires_valid_title_summary_story_category_and_goal" }, origin);
      }
      const reviewToken = token();
      const { data: row, error } = await db.from("ifund_creator_mandates").update({
        draft_payload: draft, creator_review_state: "pending", creator_feedback: null, creator_approved_at: null,
        review_token_hash: await hash(reviewToken), updated_at: new Date().toISOString(),
      }).eq("id", mandateId).eq("assigned_admin_id", user.id).eq("status", "active").not("identity_verified_at", "is", null).gt("expires_at", new Date().toISOString())
        .select("id,expires_at").maybeSingle();
      if (error || !row) throw error || new Error("Active, verified mandate assigned to this admin is required.");
      await event(db, row.id, "admin", user.id, "draft_submitted", { draft_sha256: await hash(serialized) });
      return json(200, { saved: true, review_url: `https://interplanetaryfund.com/creator-review?token=${reviewToken}`, expires_at: row.expires_at, message: "Share this secure review link with the creator. It permits review, requested changes, approval, and revocation only." }, origin);
    }
    if (action === "revoke" && req.method === "POST") {
      const mandateId = clean(body.mandate_id, 64);
      const reason = clean(body.reason, 1000);
      if (!/^[0-9a-f-]{36}$/i.test(mandateId) || reason.length < 10) return json(422, { error: "revocation_reason_required" }, origin);
      const { data: row, error } = await db.from("ifund_creator_mandates").update({
        status: "revoked", revoked_at: new Date().toISOString(), revoked_reason: reason,
        consent_token_hash: null, review_token_hash: null, updated_at: new Date().toISOString(),
      }).eq("id", mandateId).eq("assigned_admin_id", user.id).in("status", ["invited","consented_pending_verification","active"])
        .select("id").maybeSingle();
      if (error || !row) throw error || new Error("Active mandate assigned to this admin was not found.");
      const { error: destinationError } = await db.from("ifund_managed_external_destinations").update({
        status: "revoked", creator_approval_token_hash: null, updated_at: new Date().toISOString(),
      }).eq("mandate_id", row.id).not("status", "in", "(rejected,revoked)");
      if (destinationError) throw destinationError;
      await event(db, row.id, "admin", user.id, "revoked", { reason });
      return json(200, { revoked: true }, origin);
    }
    return json(404, { error: "unknown_action" }, origin);
  } catch (error) {
    const status = Number(error?.status) || 500;
    if (status >= 500) console.error("ifund-managed-creator-mandates", error);
    return json(status, { error: status >= 500 ? "managed_mandate_operation_failed" : error.message }, origin);
  }
});
