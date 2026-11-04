import test from "node:test";
import assert from "node:assert/strict";
import { serverCountryCode } from "../src/lib/server-country.ts";

test("server countries reuse the match-history mapping", () => {
  for (const [server, cc] of [["Tokyo", "jp"], ["Hong Kong", "hk"], ["Singapore", "sg"],
    ["Mumbai", "in"], ["Sydney", "au"], ["Seoul", "kr"], ["London", "gb"], ["Sao Paulo", "br"]]) {
    assert.equal(serverCountryCode(server), cc);
  }
});
test("numbered and padded cluster labels keep their server-country flag", () => {
  assert.equal(serverCountryCode(" Tokyo 1 "), "jp");
  assert.equal(serverCountryCode("Hong Kong 2"), "hk");
});
test("unknown servers and regions never invent a country", () => {
  for (const server of ["", "Unknown Cluster", "ap", "toString", "__proto__"]) {
    assert.equal(serverCountryCode(server), undefined);
  }
});
