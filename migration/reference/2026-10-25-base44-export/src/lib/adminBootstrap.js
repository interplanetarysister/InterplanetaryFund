export const ADMIN_BOOTSTRAP_EMAILS = Object.freeze([
  "interplanetarysister@gmail.com",
  "unrewound@gmail.com",
  "cuddlemeplatonically@gmail.com",
]);

export const SUPER_ADMIN_OWNER_EMAILS = Object.freeze([
  "cuddlemeplatonically@gmail.com",
  "interplanetarysister@gmail.com",
]);

const normalizeEmail = (email) => String(email || "").trim().toLowerCase();

export function isAdminBootstrapEmail(email) {
  return ADMIN_BOOTSTRAP_EMAILS.includes(normalizeEmail(email));
}

export function isSuperAdminOwnerEmail(email) {
  return SUPER_ADMIN_OWNER_EMAILS.includes(normalizeEmail(email));
}

export function getFrontendIdentity(user) {
  const canonicalAdmin = user?.role === "admin";
  const superAdminOwner = canonicalAdmin && isSuperAdminOwnerEmail(user?.email);
  return Object.freeze({
    canonicalAdmin,
    superAdminOwner,
    frontendRole: superAdminOwner ? "super_admin" : canonicalAdmin ? "admin" : "user",
    ownershipContext: superAdminOwner ? Object.freeze({
      accountOwner: true,
      platformOwner: true,
      platformCreator: true,
      softwareDeveloper: true,
      hostingOwner: true,
      webOwner: true,
      appOwner: true,
      frontendOwner: true,
      backendOwner: true,
      buildOwner: true,
    }) : null,
  });
}

// ADMIN_BOOTSTRAP_EMAILS are recovery/bootstrap metadata only, never authorization.\n// The super-admin owner identity is for non-internal frontend recognition and
// contextual UX only. It becomes active only after the canonical backend has
// authenticated the connected account AND returned User.role === "admin".
// Protected data/actions must continue to enforce server-side admin checks.
