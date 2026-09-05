/*
 * Interplanetary Fund — Copyright © 2026 Michelle Rogers. All Rights Reserved.
 * PROPRIETARY AND CONFIDENTIAL.
 *
 * Server-verifiable admin sessions.
 *
 * The app does not currently mount a Convex authentication provider, so admin
 * authorization cannot safely depend on ctx.auth. Instead, a successful admin
 * login creates a short-lived opaque session record in the existing
 * adminSettings table. The document ID is the session capability; PINs are
 * never returned to or persisted by the client after login.
 */

const ADMIN_SESSION_KEY = "admin_session";
export const ADMIN_SESSION_TTL_MS = 8 * 60 * 60 * 1000;

export type AdminPrincipal = {
  userId: string;
  name: string;
  email: string;
  role: string;
  permissions: string[];
  legacy: boolean;
};

type StoredSession = {
  adminUserId?: string;
  legacy?: boolean;
  legacyCredentialUpdatedAt?: string;
  createdAt: number;
  expiresAt: number;
};

export async function createAdminSessionRecord(
  ctx: any,
  data: Omit<StoredSession, "createdAt" | "expiresAt">
) {
  const now = Date.now();
  return await ctx.db.insert("adminSettings", {
    key: ADMIN_SESSION_KEY,
    value: JSON.stringify({
      ...data,
      createdAt: now,
      expiresAt: now + ADMIN_SESSION_TTL_MS,
    }),
    updatedAt: new Date(now).toISOString(),
  });
}

function parseSession(value: string): StoredSession | null {
  try {
    const parsed = JSON.parse(value);
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      typeof parsed.createdAt !== "number" ||
      typeof parsed.expiresAt !== "number"
    ) {
      return null;
    }
    return parsed as StoredSession;
  } catch {
    return null;
  }
}

export async function requireAdminSession(
  ctx: any,
  sessionId: any,
  permission?: string
): Promise<AdminPrincipal> {
  if (!sessionId) throw new Error("Admin session required.");

  const sessionDoc = await ctx.db.get(sessionId);
  if (!sessionDoc || sessionDoc.key !== ADMIN_SESSION_KEY) {
    throw new Error("Admin session is invalid or has been revoked.");
  }

  const session = parseSession(sessionDoc.value);
  if (!session || session.expiresAt <= Date.now()) {
    throw new Error("Admin session has expired. Sign in again.");
  }

  let principal: AdminPrincipal;

  if (session.adminUserId) {
    const adminUser = await ctx.db.get(session.adminUserId as any);
    if (!adminUser || !adminUser.active) {
      throw new Error("Admin account is inactive or no longer exists.");
    }

    principal = {
      userId: String(adminUser._id),
      name: adminUser.name,
      email: adminUser.email,
      role: adminUser.role,
      permissions:
        adminUser.role === "super_admin"
          ? ["finance", "campaigns", "platforms", "content", "settings", "reports", "users"]
          : adminUser.permissions,
      legacy: false,
    };
  } else if (session.legacy) {
    // Legacy super-admin access is accepted only when an explicit credential
    // exists. There is intentionally no hard-coded default PIN fallback.
    const pinSetting = await ctx.db
      .query("adminSettings")
      .withIndex("byKey", (q: any) => q.eq("key", "admin_pin"))
      .first();
    const feeConfig = await ctx.db.query("feeConfig").first();
    const currentUpdatedAt = pinSetting?.updatedAt ?? feeConfig?.updatedAt;
    const credentialExists = Boolean(pinSetting?.value || feeConfig?.adminPin);

    if (
      !credentialExists ||
      !currentUpdatedAt ||
      currentUpdatedAt !== session.legacyCredentialUpdatedAt
    ) {
      throw new Error("Legacy admin credential changed or was removed. Sign in again.");
    }

    principal = {
      userId: "legacy_super_admin",
      name: "Platform Owner",
      email: "",
      role: "super_admin",
      permissions: ["finance", "campaigns", "platforms", "content", "settings", "reports", "users"],
      legacy: true,
    };
  } else {
    throw new Error("Admin session is malformed.");
  }

  if (
    permission &&
    principal.role !== "super_admin" &&
    !principal.permissions.includes(permission)
  ) {
    throw new Error(`Access denied. The "${permission}" permission is required.`);
  }

  return principal;
}

export async function requireSuperAdminSession(ctx: any, sessionId: any) {
  const principal = await requireAdminSession(ctx, sessionId);
  if (principal.role !== "super_admin") {
    throw new Error("Super admin access required.");
  }
  return principal;
}

export async function revokeAdminSessionRecord(ctx: any, sessionId: any) {
  const sessionDoc = await ctx.db.get(sessionId);
  if (sessionDoc?.key === ADMIN_SESSION_KEY) {
    await ctx.db.delete(sessionId);
  }
}
