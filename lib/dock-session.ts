import "server-only";

export const TEAM_REFRESH_COOKIE = "dock_refresh";
export const REMEMBER_SESSION_SECONDS = 30 * 24 * 60 * 60;

export const teamCookieOptions = {
  httpOnly: true,
  sameSite: "lax",
  secure: process.env.NODE_ENV === "production",
  path: "/",
} as const;

export function authTemporarilyUnavailable(error: { status?: number } | null) {
  if (!error) return false;
  const { status } = error;
  return !status || status === 408 || status === 429 || status >= 500;
}
