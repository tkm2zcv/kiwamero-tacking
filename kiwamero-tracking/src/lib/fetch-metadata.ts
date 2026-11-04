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

/** Profile documents may be opened by an explicit external link, not embedded or fetched. */
export function profilePageInitiator(headers: Headers): boolean {
  if (sameSiteInitiator(headers)) return true;
  const speculative = [headers.get("purpose"), headers.get("sec-purpose")]
    .some((value) => /\b(prefetch|prerender)\b/i.test(value ?? ""));
  return headers.get("sec-fetch-site") === "cross-site" &&
    headers.get("sec-fetch-mode") === "navigate" &&
    headers.get("sec-fetch-dest") === "document" &&
    headers.get("sec-fetch-user") === "?1" && !speculative;
}
