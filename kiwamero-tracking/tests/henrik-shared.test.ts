import test from "node:test";
import assert from "node:assert/strict";
import { mapSplash, playerCardArt } from "../src/lib/henrik-shared.ts";

const CARD_ID = "3c732397-4398-a6ac-e116-56af7378d8d7";
const MAP_ID = "2fb9a4fd-47b8-4e7d-a969-74b4046ebd53";

test("playerCardArt builds urls for uuid-shaped ids", () => {
  assert.equal(
    playerCardArt(CARD_ID),
    `https://media.valorant-api.com/playercards/${CARD_ID}/wideart.png`,
  );
  assert.equal(
    playerCardArt(CARD_ID, "smallart"),
    `https://media.valorant-api.com/playercards/${CARD_ID}/smallart.png`,
  );
  assert.equal(
    playerCardArt("abc_DEF-123"),
    "https://media.valorant-api.com/playercards/abc_DEF-123/wideart.png",
  );
});

test("playerCardArt sanitizes css url() breakout ids", () => {
  // Quoted-url breakout (hero.tsx backgroundImage url("...") sink).
  const out = playerCardArt('x"),url(https://evil.example/x.png),url("');
  assert.equal(out, "https://media.valorant-api.com/playercards//wideart.png");
  for (const bad of ['"', "'", "(", ")", ",", " ", "evil.example"]) {
    assert.equal(out.includes(bad), false, `output should not contain ${bad}`);
  }
});

test("mapSplash builds urls for uuid-shaped ids", () => {
  assert.equal(mapSplash(MAP_ID), `https://media.valorant-api.com/maps/${MAP_ID}/splash.png`);
});

test("mapSplash sanitizes unquoted css url() breakout ids", () => {
  // Unquoted-url breakout (maps-table --background-image-url sink) needs no quotes.
  const out = mapSplash("x),url(https://evil.example/x.png),url(");
  assert.equal(out, "https://media.valorant-api.com/maps//splash.png");
  for (const bad of [")", ",", " ", "evil.example"]) {
    assert.equal(out.includes(bad), false, `output should not contain ${bad}`);
  }
});

test("asset id builders reject empty, oversized, and metacharacter ids", () => {
  assert.equal(playerCardArt(""), "https://media.valorant-api.com/playercards//wideart.png");
  assert.equal(playerCardArt("a".repeat(65)), "https://media.valorant-api.com/playercards//wideart.png");
  assert.equal(playerCardArt("a".repeat(64)), `https://media.valorant-api.com/playercards/${"a".repeat(64)}/wideart.png`);
  assert.equal(mapSplash("../x"), "https://media.valorant-api.com/maps//splash.png");
  assert.equal(mapSplash("x\nurl()"), "https://media.valorant-api.com/maps//splash.png");
});
