import test from "node:test";
import assert from "node:assert/strict";
import { dicts } from "../src/lib/i18n/dict.ts";
import { watchlistRemoveBody } from "../src/lib/watchlist-copy.ts";

test("watch removal dialog copy exists in every locale", () => {
  for (const dict of Object.values(dicts)) {
    assert.ok(dict.watchlist.removeTitle);
    assert.ok(dict.watchlist.removeConfirm);
    assert.ok(dict.watchlist.removeCancel);
    assert.ok(dict.watchlist.removeBusy);
    assert.ok(dict.watchlist.removeError);
    assert.match(dict.watchlist.removeBody, /\{player\}/);
  }
});

test("watch removal body replaces every player placeholder", () => {
  assert.equal(
    watchlistRemoveBody("Remove {player}? {player} will not alert.", "Meiy#B3L"),
    "Remove Meiy#B3L? Meiy#B3L will not alert.",
  );
});
