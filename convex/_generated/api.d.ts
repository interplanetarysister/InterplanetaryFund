/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as accountTracker from "../accountTracker.js";
import type * as adminUsers from "../adminUsers.js";
import type * as agents from "../agents.js";
import type * as antiSpam from "../antiSpam.js";
import type * as auth from "../auth.js";
import type * as autonomous from "../autonomous.js";
import type * as campaignDefaults from "../campaignDefaults.js";
import type * as campaigns from "../campaigns.js";
import type * as cleanupPlatforms from "../cleanupPlatforms.js";
import type * as community from "../community.js";
import type * as crons from "../crons.js";
import type * as facebook from "../facebook.js";
import type * as fixCampaignStatus from "../fixCampaignStatus.js";
import type * as fixPlatforms from "../fixPlatforms.js";
import type * as fixPublishing from "../fixPublishing.js";
import type * as fraudControl from "../fraudControl.js";
import type * as fundMigration from "../fundMigration.js";
import type * as inbox from "../inbox.js";
import type * as interactions from "../interactions.js";
import type * as outreach from "../outreach.js";
import type * as paypalCheckout from "../paypalCheckout.js";
import type * as postContent from "../postContent.js";
import type * as protocol from "../protocol.js";
import type * as research from "../research.js";
import type * as security from "../security.js";
import type * as seed from "../seed.js";
import type * as simpleWithdraw from "../simpleWithdraw.js";
import type * as syncRaisedAmounts from "../syncRaisedAmounts.js";
import type * as treasury from "../treasury.js";
import type * as userAuth from "../userAuth.js";
import type * as userCampaigns from "../userCampaigns.js";
import type * as userManagement from "../userManagement.js";
import type * as withdrawalMethods from "../withdrawalMethods.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  accountTracker: typeof accountTracker;
  adminUsers: typeof adminUsers;
  agents: typeof agents;
  antiSpam: typeof antiSpam;
  auth: typeof auth;
  autonomous: typeof autonomous;
  campaignDefaults: typeof campaignDefaults;
  campaigns: typeof campaigns;
  cleanupPlatforms: typeof cleanupPlatforms;
  community: typeof community;
  crons: typeof crons;
  facebook: typeof facebook;
  fixCampaignStatus: typeof fixCampaignStatus;
  fixPlatforms: typeof fixPlatforms;
  fixPublishing: typeof fixPublishing;
  fraudControl: typeof fraudControl;
  fundMigration: typeof fundMigration;
  inbox: typeof inbox;
  interactions: typeof interactions;
  outreach: typeof outreach;
  paypalCheckout: typeof paypalCheckout;
  postContent: typeof postContent;
  protocol: typeof protocol;
  research: typeof research;
  security: typeof security;
  seed: typeof seed;
  simpleWithdraw: typeof simpleWithdraw;
  syncRaisedAmounts: typeof syncRaisedAmounts;
  treasury: typeof treasury;
  userAuth: typeof userAuth;
  userCampaigns: typeof userCampaigns;
  userManagement: typeof userManagement;
  withdrawalMethods: typeof withdrawalMethods;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
