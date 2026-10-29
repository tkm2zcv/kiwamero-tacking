import test from "node:test";
import assert from "node:assert/strict";
import { resolveLocale } from "../src/lib/i18n/locale.ts";
import { dicts } from "../src/lib/i18n/dict.ts";

test("manual language cookie overrides browser preferences", () => {
  assert.equal(resolveLocale("en", "ja-JP,ja;q=0.9"), "en");
  assert.equal(resolveLocale("ja", "en-US,en;q=0.9"), "ja");
});

test("new visitors use supported browser languages in quality order", () => {
  assert.equal(resolveLocale(undefined, "ja-JP,ja;q=0.9,en-US;q=0.8"), "ja");
  assert.equal(resolveLocale(undefined, "en-US;q=0.3,ja-JP;q=0.9"), "ja");
  assert.equal(resolveLocale(undefined, "fr-FR,ja;q=0.8,en;q=0.5"), "ja");
  assert.equal(resolveLocale(undefined, "JA-jp"), "ja");
  assert.equal(resolveLocale(undefined, "ja;q=0,en;q=0.5"), "en");
});

test("invalid or unsupported preferences fall back safely", () => {
  assert.equal(resolveLocale("invalid", "ja-JP"), "ja");
  assert.equal(resolveLocale(undefined, "fr-FR,de"), "en");
  assert.equal(resolveLocale(undefined, "ja;q=invalid,en;q=0.5"), "en");
  assert.equal(resolveLocale(undefined, null), "en");
});

test("audit copy describes a recent sample, not lifetime statistics", () => {
  assert.match(dicts.en.audit.sampleMatches, /Recent.*Sample/);
  assert.match(dicts.en.audit.sampleNote, /not lifetime/);
  assert.ok(dicts.ja.audit.sampleMatches.includes("直近"));
  assert.ok(dicts.ja.audit.sampleNote.includes("生涯成績ではありません"));
});
