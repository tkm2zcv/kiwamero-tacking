import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const PNG_SIGNATURE = Buffer.from("89504e470d0a1a0a", "hex");

test("app and Apple icons have the expected PNG format and dimensions", () => {
  for (const [name, size] of [["icon.png", 512], ["apple-icon.png", 180]] as const) {
    const png = readFileSync(`src/app/${name}`);
    assert.deepEqual(png.subarray(0, 8), PNG_SIGNATURE, name);
    assert.equal(png.toString("ascii", 12, 16), "IHDR", name);
    assert.equal(png.readUInt32BE(16), size, name);
    assert.equal(png.readUInt32BE(20), size, name);
    assert.ok(png.length < 512 * 1024, `${name} should remain a small static asset`);
  }
});

test("favicon contains valid, compressed frames for small tabs and high-DPI displays", () => {
  const ico = readFileSync("src/app/favicon.ico");
  assert.equal(ico.readUInt16LE(0), 0);
  assert.equal(ico.readUInt16LE(2), 1);
  assert.equal(ico.readUInt16LE(4), 7);
  const sizes: number[] = [];
  for (let i = 0; i < 7; i++) {
    const entry = 6 + i * 16;
    const size = ico[entry] || 256;
    assert.equal(ico[entry + 1] || 256, size);
    const length = ico.readUInt32LE(entry + 8);
    const offset = ico.readUInt32LE(entry + 12);
    assert.ok(offset >= 6 + 7 * 16 && length > 24 && offset + length <= ico.length);
    assert.deepEqual(ico.subarray(offset, offset + 8), PNG_SIGNATURE);
    assert.equal(ico.readUInt32BE(offset + 16), size);
    assert.equal(ico.readUInt32BE(offset + 20), size);
    sizes.push(size);
  }
  assert.deepEqual(sizes.sort((a, b) => a - b), [16, 24, 32, 48, 64, 128, 256]);
  assert.ok(ico.length < 256 * 1024, "favicon frames should use PNG compression");
});
