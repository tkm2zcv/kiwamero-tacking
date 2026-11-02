import test from "node:test";
import assert from "node:assert/strict";
import { isSearchImageBlob } from "../src/lib/image-search-browser.ts";

test("clipboard images without a MIME type can still be decoded", () => {
  assert.equal(isSearchImageBlob(new Blob([new Uint8Array(4)], { type: "" })), true);
  assert.equal(isSearchImageBlob(new Blob([new Uint8Array(4)], { type: "image/png" })), true);
  assert.equal(isSearchImageBlob(new Blob([new Uint8Array(4)], { type: "application/octet-stream" })), false);
});

test("large clipboard bitmaps fit the decode budget while oversized blobs are rejected", () => {
  assert.equal(isSearchImageBlob(new Blob([new Uint8Array(32 * 1024 * 1024)], { type: "image/bmp" })), true);
  assert.equal(isSearchImageBlob(new Blob([new Uint8Array(32 * 1024 * 1024 + 1)], { type: "image/bmp" })), false);
});
