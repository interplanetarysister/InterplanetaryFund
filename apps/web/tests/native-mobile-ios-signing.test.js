import test from "node:test";
import assert from "node:assert/strict";
import { addIosSigningEntitlements } from "../../mobile/scripts/configure-native-project.mjs";

const appConfig = (name, bundleId) => [
  "/* " + name + " */ = {",
  "  isa = XCBuildConfiguration;",
  "  buildSettings = {",
  "    CODE_SIGN_STYLE = Automatic;",
  "    PRODUCT_BUNDLE_IDENTIFIER = " + bundleId + ";",
  "  };",
  "};",
].join("\n");

test("iOS signing config adds Associated Domains only to independent iFund app", () => {
  const project = "/* Begin XCBuildConfiguration section */\n" +
    appConfig("Debug", "com.vendor.other") + "\n" +
    appConfig("Debug", "com.interplanetaryfund.app") + "\n" +
    appConfig("Release", "com.interplanetaryfund.app");
  const updated = addIosSigningEntitlements(project);
  assert.equal(updated.split("CODE_SIGN_ENTITLEMENTS = App/App.entitlements;").length - 1, 2);
  assert.equal(addIosSigningEntitlements(updated), updated);
  assert.match(updated, /PRODUCT_BUNDLE_IDENTIFIER = com\.vendor\.other/);
  assert.doesNotMatch(updated.split("/* Debug */ = {")[1],
    /CODE_SIGN_ENTITLEMENTS = App\/App.entitlements/);
});
test("iOS signing config fails closed on unexpected target and preexisting capabilities", () => {
  const head = "/* Begin XCBuildConfiguration section */\n";
  assert.throws(() => addIosSigningEntitlements(head + appConfig("Debug", "com.elsewhere.app")), /both App target/);
  const valid = head + appConfig("Debug", "com.interplanetaryfund.app") + "\n" +
    appConfig("Release", "com.interplanetaryfund.app");
  assert.throws(() => addIosSigningEntitlements(valid.replace("CODE_SIGN_STYLE = Automatic;",
    "CODE_SIGN_ENTITLEMENTS = Other/Other.entitlements;\nCODE_SIGN_STYLE = Automatic;")),
    /unexpected signing entitlement/);
});
