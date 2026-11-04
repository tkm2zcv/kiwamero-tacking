import test from "node:test";
import assert from "node:assert/strict";
import { register } from "node:module";

register("./route-hooks.mjs", import.meta.url);
const { sameSiteInitiator, profilePageInitiator, externalProfileDocument } = await import("../src/lib/fetch-metadata.ts");
const navigation = { "sec-fetch-site": "cross-site", "sec-fetch-mode": "navigate",
  "sec-fetch-dest": "document", "sec-fetch-user": "?1" };

test("user-activated external document links are allowed only by the profile-page policy", () => {
  assert.equal(profilePageInitiator(new Headers(navigation)), true);
  assert.equal(sameSiteInitiator(new Headers(navigation)), false, "paid API routes stay strict");
});
test("HTML/JS relay documents open directly without user-activation metadata; APIs stay strict", () => {
  const headers = new Headers(navigation);
  headers.delete("sec-fetch-user");
  assert.equal(externalProfileDocument(headers), true);
  assert.equal(profilePageInitiator(headers), true);
  assert.equal(sameSiteInitiator(headers), false);
  for (const overrides of [
    { "sec-fetch-dest": "iframe" }, { "sec-fetch-mode": "cors" },
    { "sec-fetch-site": "unexpected" }, { purpose: "prefetch" }, { "sec-purpose": "prerender" },
  ] as Record<string, string>[]) {
    assert.equal(externalProfileDocument(new Headers({ ...navigation, ...overrides })), false);
  }
});
test("external fetches, frames and speculative loads are rejected", () => {
  const changes: Record<string, string>[] = [
    { "sec-fetch-mode": "cors", "sec-fetch-dest": "empty" },
    { "sec-fetch-mode": "no-cors" }, { "sec-fetch-mode": "same-origin" },
    { "sec-fetch-dest": "iframe" }, { "sec-fetch-dest": "frame" }, { "sec-fetch-dest": "empty" },
    { purpose: "prefetch" }, { "sec-purpose": "prefetch;prerender" },
    { "sec-purpose": "prerender" }, { "sec-fetch-site": "unexpected" },
  ];
  for (const change of changes) {
    const headers = new Headers({ ...navigation, ...change });
    assert.equal(profilePageInitiator(headers), false, JSON.stringify(change));
    assert.equal(sameSiteInitiator(headers), false);
  }
  for (const key of ["sec-fetch-mode", "sec-fetch-dest"]) {
    const headers = new Headers(navigation);
    headers.delete(key);
    assert.equal(profilePageInitiator(headers), false, `missing ${key}`);
  }
});
test("direct/bookmark and same-origin navigation retain the existing policy", () => {
  for (const site of ["none", "same-origin", "same-site", ""]) {
    const headers = new Headers(site ? { "sec-fetch-site": site } : {});
    assert.equal(profilePageInitiator(headers), true);
    assert.equal(sameSiteInitiator(headers), true);
  }
});
