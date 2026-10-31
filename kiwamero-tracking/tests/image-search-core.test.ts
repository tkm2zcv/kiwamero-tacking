import test from "node:test";
import assert from "node:assert/strict";
import {
  clampImageCrop, extractImageCandidates, FULL_IMAGE_CROP, imageSearchProfilePath,
  parseImageRiotId, suggestImageCrop,
} from "../src/lib/image-search-core.ts";

test("image search preserves complete unicode and numeric Riot IDs without ASCII word boundaries", () => {
  for (const id of ["Player#日本語", "Player#JP日本", "12345#JP1", "star★player#JP1", "カナﾂ#タグ1"]) {
    const [name, tag] = id.split("#");
    assert.deepEqual(parseImageRiotId(id), { name, tag });
    assert.deepEqual(extractImageCandidates([id]).pairs, [{ name, tag }]);
  }
});

test("image OCR tolerates tag whitespace and fullwidth separators without changing name identity", () => {
  assert.deepEqual(extractImageCandidates(["  crazy Boberツ野獣先輩 ＃ 1 9 9 4  "]).pairs,
    [{ name: "crazy Boberツ野獣先輩", tag: "1994" }]);
  assert.deepEqual(parseImageRiotId(" Ａliceﾂ #JP1 "), { name: "Ａliceﾂ", tag: "JP1" });
  assert.equal(parseImageRiotId("Alice#J P1"), null, "manual entry must not silently rewrite the ID");
  assert.equal(extractImageCandidates(["Player#日本語"]).pairs[0].tag, "日本語");
});

test("legitimate name spaces are not removed or collapsed when candidates and URLs are formed", () => {
  for (const name of ["crazy Boberツ野獣先輩", "Team  Player", "おな ちゅ", "おな　ちゅ"]) {
    assert.deepEqual(extractImageCandidates([`${name}#JP1`]).pairs, [{ name, tag: "JP1" }]);
    assert.equal(imageSearchProfilePath({ name, tag: "JP1" }),
      `/valorant/profile/riot/${encodeURIComponent(`${name}#JP1`)}/overview`);
  }
});

test("image OCR never truncates invalid tags or silently strips part of a name", () => {
  for (const id of ["Alice#TOOLONG", "Alice#JP!", "Alice#JP1#NA1", `${"A".repeat(31)}#JP1`]) {
    assert.equal(parseImageRiotId(id), null);
    assert.deepEqual(extractImageCandidates([id]).pairs, []);
  }
  assert.equal(parseImageRiotId("Alice\nBob#JP1"), null);
  assert.equal(parseImageRiotId("#JP1"), null);
  assert.equal(parseImageRiotId("Alice#"), null);
});

test("image candidates merge both OCR passes and bound unrelated text", () => {
  const result = extractImageCandidates(["Meiy#B3L\nMurao\nPlayer#日本語", "meiy#b3l\nmurao\nOther#NA1"]);
  assert.deepEqual(result, { pairs: [
    { name: "Meiy", tag: "B3L" }, { name: "Player", tag: "日本語" }, { name: "Other", tag: "NA1" },
  ], names: ["Murao"] });
  const many = extractImageCandidates([Array.from({ length: 40 }, (_, i) => `Player${i}#JP1\nName${i}`).join("\n")]);
  assert.equal(many.pairs.length, 12);
  assert.equal(many.names.length, 8);
});

test("image search encodes the complete verified ID into the existing profile route", () => {
  assert.equal(imageSearchProfilePath({ name: "crazy Boberツ野獣先輩", tag: "1994" }),
    `/valorant/profile/riot/${encodeURIComponent("crazy Boberツ野獣先輩#1994")}/overview`);
  assert.equal(imageSearchProfilePath({ name: "a/b?c", tag: "JP1" }),
    "/valorant/profile/riot/a%2Fb%3Fc%23JP1/overview");
});

test("crop bounds cannot escape the image or produce a zero-size canvas", () => {
  assert.deepEqual(clampImageCrop({ left: -20, right: 120, top: -10, bottom: 150 }), FULL_IMAGE_CROP);
  assert.deepEqual(clampImageCrop({ left: 100, right: 5, top: 100, bottom: 0 }),
    { left: 99, right: 100, top: 99, bottom: 100 });
  assert.deepEqual(clampImageCrop({ left: NaN, top: Infinity, right: NaN, bottom: -Infinity }),
    FULL_IMAGE_CROP);
});

test("a dark tooltip gets a suggested crop rather than OCR of the entire roster", () => {
  const width = 300, height = 150;
  const pixels = new Uint8ClampedArray(width * height * 4).fill(255);
  for (let y = 10; y < 45; y++) for (let x = 20; x < 280; x++) {
    const i = (y * width + x) * 4;
    pixels[i] = pixels[i + 1] = pixels[i + 2] = 15;
  }
  const crop = suggestImageCrop(pixels, width, height);
  assert.ok(crop.top <= 10 / height * 100 && crop.bottom >= 45 / height * 100);
  assert.ok(crop.bottom < 50, "other player rows must remain outside the suggestion");
  assert.ok(crop.left > 0 && crop.right < 100, "adjacent icons must remain outside the suggestion");
  assert.deepEqual(suggestImageCrop(new Uint8ClampedArray(width * height * 4).fill(255), width, height),
    FULL_IMAGE_CROP);
});

test("large uniform dark scenes and very thin rules do not masquerade as a name tooltip", () => {
  const pixels = new Uint8ClampedArray(200 * 100 * 4);
  for (let i = 3; i < pixels.length; i += 4) pixels[i] = 255;
  assert.deepEqual(suggestImageCrop(pixels, 200, 100), FULL_IMAGE_CROP);
});
