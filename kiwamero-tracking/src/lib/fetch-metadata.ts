import "server-only";

/**
 * Reject requests initiated by a cross-site context. `none` covers direct
 * navigations (typed URL, bookmark) — only cookie-authenticated requests from
 * another site are refused, so state-changing GETs cannot be CSRF-driven.
 */
export function sameSiteInitiator(headers: Headers): boolean {
  const site = headers.get("sec-fetch-site");
  if (!site) return true; // non-browser clients (curl, kt_ keys) carry no ambient cookie
  return site === "same-origin" || site === "same-site" || site === "none";
}
