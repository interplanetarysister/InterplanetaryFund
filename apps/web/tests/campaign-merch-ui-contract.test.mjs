import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const read = path => readFileSync(fileURLToPath(new URL(path, import.meta.url)), "utf8");

test("optional merch studio is owner-scoped and reachable from existing editor", () => {
  const strategy = read("../src/pages/CampaignStrategy.jsx");
  const editor = read("../src/pages/EditCampaign.jsx");
  const studio = read("../src/components/campaigns/CampaignMerchDesigner.jsx");
  assert.match(strategy,/CampaignMerchDesigner/);
  assert.match(strategy,/ownedCampaign/);
  assert.match(editor,/strategy\?campaign=/);
  assert.match(studio,/validateMerchDesignRequest/);
  assert.match(studio,/namePublicationApproved/);
  assert.match(studio,/artworkRightsConfirmed/);
  assert.match(studio,/Generate optional AI art/);
  assert.match(studio,/Nothing was published|No Printful order/);
});
test("storage feature flag is default-off and saved design rows are private drafts", () => {
  const api = read("../src/api/merchDrafts.js");
  const migration = read("../../../supabase/migrations/20261120090000_ifund_private_merch_design_drafts.sql");
  assert.match(api,/VITE_IFUND_MERCH_DRAFTS_ENABLED\s*===\s*"enabled"/);
  assert.match(api,/owner_id/);
  assert.match(api,/auth\.getUser\(\)/);
  assert.match(migration,/ENABLE ROW LEVEL SECURITY/);
  assert.match(migration,/REFERENCES public\.ifund_campaigns\(id\)/);
  assert.match(migration,/WITH CHECK/);
  assert.match(migration,/status\s+text NOT NULL DEFAULT 'draft' CHECK \(status='draft'\)/);
  assert.doesNotMatch(migration,/GRANT\s+.*ON public\.ifund_campaign_merch_designs TO anon/i);
});
test("shared cosmetic buttons preserve a11y and skip reduced motion", () => {
  const button = read("../src/components/ui/button.jsx");
  const style = read("../src/styles/ifund-next-cosmic.css");
  const entry = read("../src/main.jsx");
  assert.match(button,/aria-busy/);
  assert.match(button,/LoaderCircle/);
  assert.match(style,/prefers-reduced-motion/);
  assert.match(style,/focus-visible/);
  assert.match(style,/ifund-dashboard-hero/);
  assert.match(style,/ifund-merch-preview/);
  assert.match(entry,/ifund-next-cosmic\.css/);
});
