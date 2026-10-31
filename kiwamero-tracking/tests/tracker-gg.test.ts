import { test } from "node:test";
import assert from "node:assert/strict";
import { trackerProfileUrl } from "../src/lib/tracker-gg.ts";

test("tracker.gg URL encodes name and tag like the local route", () => {
  assert.equal(
    trackerProfileUrl("Meiy", "B3L"),
    "https://tracker.gg/valorant/profile/riot/Meiy%23B3L/overview",
  );
});

test("spaces and unicode names survive encoding", () => {
  assert.equal(
    trackerProfileUrl("crazy Boberツ野獣先輩", "1994"),
    "https://tracker.gg/valorant/profile/riot/crazy%20Bober%E3%83%84%E9%87%8E%E7%8D%A3%E5%85%88%E8%BC%A9%231994/overview",
  );
  assert.equal(
    trackerProfileUrl("おなちゅ", "3409"),
    "https://tracker.gg/valorant/profile/riot/%E3%81%8A%E3%81%AA%E3%81%A1%E3%82%85%233409/overview",
  );
});
