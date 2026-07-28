// Admin isn't a stored DB flag — it's derived from either the logged-in
// email (ADMIN_EMAILS, for the Яндекс/почта login path) or the logged-in
// username (ADMIN_USERNAME, for the username+password path) matching an
// env var. Granting/revoking access is a one-line env var change, not a
// migration or a manual DB edit.
const DEFAULT_ADMIN_EMAILS = "dimitrystaristenko@gmail.com";

export function isAdminEmail(email?: string | null) {
  if (!email) return false;
  const admins = (process.env.ADMIN_EMAILS || DEFAULT_ADMIN_EMAILS)
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return admins.includes(email.toLowerCase());
}

export function isAdminUsername(username?: string | null) {
  if (!username) return false;
  const admin = (process.env.ADMIN_USERNAME || "").trim().toLowerCase();
  return !!admin && admin === username.toLowerCase();
}

// Nobody but the real admin account may register this exact username —
// checked at signup time so it can never be squatted by another student.
export function isReservedUsername(username: string) {
  return isAdminUsername(username);
}

export function isAdminSession(session: { user?: { email?: string | null; username?: string | null } } | null | undefined) {
  return isAdminEmail(session?.user?.email) || isAdminUsername(session?.user?.username);
}
