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

/** Non-speculative external documents can offer a same-origin confirmation, not start paid work. */
export function externalProfileDocument(headers: Headers): boolean {
  const speculative = [headers.get("purpose"), headers.get("sec-purpose")]
    .some((value) => /\b(prefetch|prerender)\b/i.test(value ?? ""));
  return headers.get("sec-fetch-site") === "cross-site" &&
    headers.get("sec-fetch-mode") === "navigate" &&
    headers.get("sec-fetch-dest") === "document" && !speculative;
}

/** Profile data loads only for same-site requests or explicit top-level external clicks. */
export function profilePageInitiator(headers: Headers): boolean {
  return sameSiteInitiator(headers) ||
    (externalProfileDocument(headers) && headers.get("sec-fetch-user") === "?1");
}
