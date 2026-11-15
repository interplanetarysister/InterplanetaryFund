import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const read = path => readFileSync(new URL("../" + path, import.meta.url), "utf8");
const scope = JSON.parse(read("../mobile/ci/store-scope.json"));
const app = read("src/MobileStoreApp.jsx");
const native = JSON.parse(read("../mobile/capacitor.config.json"));

test("mobile store review build is a separately bundled app, not website wrapper", () => {
  assert.equal(native.appId,"com.interplanetaryfund.app");
  assert.equal(native.webDir,"../web/dist-mobile");
  assert.equal(native.server.url,undefined);
  assert.match(read("src/mobile-main.jsx"), /MobileStoreApp/);
  assert.match(read("vite.mobile.config.js"), /publicDir: false/);
  assert.match(read("vite.mobile.config.js"), /dist-mobile/);
  assert.match(read("vite.mobile.config.js"), /renameSync\(generated, resolve\(out, "index.html"\)\)/);
  assert.match(read("package.json"), /"build:mobile"/);
});

test("all marketed native routes are real registered pages",()=>{
  assert.equal(scope.schema_version,1);
  assert.equal(scope.app_id,native.appId);
  for(const path of scope.routes)
    assert.ok(app.includes('<Route path="'+path+'"'),"Missing app route: "+path);
  for(const path of scope.excluded_routes)
    assert.ok(!app.includes('<Route path="'+path+'"'),"Unreviewed feature exposed: "+path);
  assert.doesNotMatch(app,/import (?:App|Layout) from ["']@\/App/);
  assert.doesNotMatch(app,/<Route path="\/admin/);
});

test("native app discloses disabled payments instead of offering prohibited checkout",()=>{
  assert.match(app,/No purchases, monetary gifts, fundraising checkout or paid subscriptions/);
  assert.doesNotMatch(app,/CampaignDonationDialog|PayPalDonateButton|PlatformSupportHostedButton|Subscriptions|PublicSubscriptionPlans/);
  const campaign = read("src/mobile/MobileStoreCampaign.jsx");
  assert.doesNotMatch(campaign,/create-order|capture-order|PayPal|paypal\.com/);
  assert.match(campaign,/shareWithDevice/);
  assert.match(campaign,/ifund_create_support_ticket/);
  assert.match(campaign,/Hide campaign/);
});

test("account deletion is initiated from app and public Google Play deletion URL",()=>{
  const deletion = read("src/mobile/MobileStoreDeleteAccount.jsx");
  const publicPage = read("src/pages/DeleteAccount.jsx");
  const website = read("src/App.jsx");
  assert.match(deletion,/Request permanent account deletion/);
  assert.match(deletion,/ifund_create_support_ticket/);
  assert.match(deletion,/https:\/\/interplanetaryfund\.com\/delete-account/);
  assert.match(publicPage,/permanent deletion/i);
  assert.match(website,/path="\/delete-account"/);
  assert.match(read("src/mobile/MobileStoreAccount.jsx"), /to="\/delete-account"/);
});

test("store app exposes purposeful native functionality without invented payment data",()=>{
  assert.match(read("src/mobile/MobileReadiness.jsx"), /not.*prediction|not<\/strong> a prediction/s);
  assert.match(read("src/mobile/MobileStoreDiscover.jsx"), /listActiveCampaigns/);
  assert.match(read("src/mobile/MobileStoreAtlas.jsx"), /map_opt_in===true/);
  assert.match(read("src/mobile/MobileMyCampaigns.jsx"), /listMyCampaigns/);
  assert.match(read("src/mobile/MobileStoreHelp.jsx"), /hello@interplanetaryfund.com/);
  assert.match(read("src/mobile/MobileStoreHome.jsx"), /native share sheet/i);
});
