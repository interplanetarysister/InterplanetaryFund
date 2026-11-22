import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const migrations = new URL("../supabase/migrations/", import.meta.url);
const sql = (name) =>
  readFileSync(new URL(name, migrations), "utf8").replace(/\s+/g, " ");

const controlPlane = sql(
  "20261122104209_ifund_weekly_agent_training_control_plane.sql",
);
const strictClaim = sql(
  "20261122111350_ifund_training_strict_week_bound_claim.sql",
);
const superAdminReview = sql(
  "20261122111141_ifund_training_verified_superadmin_skill_review.sql",
);
const weeklyReport = sql(
  "20261122112717_ifund_training_weekly_synthesis_reports_and_admin_retrieval.sql",
);
const crossAgentRouting = sql(
  "20261122112930_ifund_training_cross_agent_reviewable_routing.sql",
);

test("weekly training mutators are service-role-only", () => {
  const signatures = [
    "public.ifund_training_start(text)",
    "public.ifund_training_claim()",
    "public.ifund_training_finish(uuid,text,jsonb,text,jsonb)",
    "public.ifund_training_claim_agent(text,date)",
  ];
  for (const signature of signatures) {
    const source =
      signature === "public.ifund_training_claim_agent(text,date)"
        ? strictClaim
        : controlPlane;
    assert.match(
      source,
      new RegExp(
        `revoke all on function ${signature.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")} from public,anon,authenticated`,
      ),
      `${signature} must deny public, anon and authenticated EXECUTE`,
    );
    assert.match(
      source,
      new RegExp(
        `grant execute on function ${signature.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")} to service_role`,
      ),
      `${signature} must grant EXECUTE only to service_role`,
    );
  }
});

test("skill approval requires a verified super admin and independent evaluation", () => {
  assert.match(
    superAdminReview,
    /if auth\.uid\(\) is null or not public\.ifund_current_user_is_verified_super_admin\(\)/,
  );
  assert.match(
    superAdminReview,
    /Independent validated evaluation is required before approval/,
  );
  assert.match(
    superAdminReview,
    /revoke all on function public\.ifund_training_review_candidate\(uuid,text,text\) from public,anon,authenticated,service_role/,
  );
  assert.doesNotMatch(
    superAdminReview,
    /grant execute on function public\.ifund_training_review_candidate\(uuid,text,text\) to service_role/,
  );
});

test("weekly report and cross-agent routing helpers are trigger-only", () => {
  assert.match(
    weeklyReport,
    /revoke all on function ifund_training\.build_weekly_report\(\) from public,anon,authenticated/,
  );
  assert.match(
    weeklyReport,
    /create trigger ifund_training_weekly_report_on_run_terminal/,
  );
  assert.doesNotMatch(
    weeklyReport,
    /grant execute on function ifund_training\.build_weekly_report\(\) to (public|anon|authenticated)/,
  );
  assert.match(
    crossAgentRouting,
    /revoke all on function ifund_training\.route_new_skill_candidate\(\) from public,anon,authenticated/,
  );
  assert.match(
    crossAgentRouting,
    /create trigger ifund_training_candidate_collaboration_router/,
  );
  assert.doesNotMatch(
    crossAgentRouting,
    /grant execute on function ifund_training\.route_new_skill_candidate\(\) to (public|anon|authenticated)/,
  );
});
