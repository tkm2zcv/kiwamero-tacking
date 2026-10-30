import test from "node:test";
import assert from "node:assert/strict";
import { getSearchHistory, recordSearch, clearSearchHistory } from "../src/lib/search-history.ts";

function withStorage<T>(fn: () => T): T {
  const store = new Map<string, string>();
  const prev = (globalThis as Record<string, unknown>).window;
  (globalThis as Record<string, unknown>).window = {
    localStorage: {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
    },
  };
  try {
    return fn();
  } finally {
    if (prev === undefined) delete (globalThis as Record<string, unknown>).window;
    else (globalThis as Record<string, unknown>).window = prev;
  }
}

test("search history records newest first, dedupes by puuid and name#tag, caps at 10", () => {
  withStorage(() => {
    recordSearch({ name: "Alice", tag: "JP1", puuid: "p1" });
    recordSearch({ name: "Bob", tag: "NA1", puuid: "p2" });
    let h = getSearchHistory();
    assert.deepEqual(h.map((e) => e.name), ["Bob", "Alice"]);
    // Same player viewed again (renamed, same puuid) moves to front once.
    recordSearch({ name: "Alicia", tag: "JP1", puuid: "p1" });
    h = getSearchHistory();
    assert.equal(h.length, 2);
    assert.equal(h[0].name, "Alicia");
    // Case-insensitive name#tag dedupe without puuid.
    recordSearch({ name: "bob", tag: "na1" });
    h = getSearchHistory();
    assert.equal(h.length, 2);
    assert.equal(h[0].name, "bob");
    for (let i = 0; i < 12; i++) recordSearch({ name: `P${i}`, tag: "T" });
    assert.equal(getSearchHistory().length, 10);
  });
});

test("history tolerates corrupt storage and clears", () => {
  withStorage(() => {
    (globalThis as { window: { localStorage: { setItem(k: string, v: string): void } } })
      .window.localStorage.setItem("kt_search_history", "{not json");
    assert.deepEqual(getSearchHistory(), []);
    recordSearch({ name: "A", tag: "B" });
    assert.equal(getSearchHistory().length, 1);
    clearSearchHistory();
    assert.deepEqual(getSearchHistory(), []);
  });
});

test("recorder ignores blank names and non-browser contexts", () => {
  withStorage(() => {
    recordSearch({ name: "", tag: "T" });
    recordSearch({ name: "N", tag: "" });
    assert.deepEqual(getSearchHistory(), []);
  });
  // No window at all → no-op, no throw.
  recordSearch({ name: "A", tag: "B" });
  assert.deepEqual(getSearchHistory(), []);
});
