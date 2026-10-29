import assert from "node:assert/strict";
import test from "node:test";
import {
  apiRateLimitPerMinute,
  checkRateLimit,
  resetRateLimitBuckets,
} from "../src/lib/rate-limit-core.ts";

test("checkRateLimit allows up to the limit then rejects", () => {
  resetRateLimitBuckets();
  const results = [1, 2, 3].map(() => checkRateLimit("k1", 2));
  assert.equal(results[0].ok, true);
  assert.equal(results[0].remaining, 1);
  assert.equal(results[1].ok, true);
  assert.equal(results[1].remaining, 0);
  assert.equal(results[2].ok, false);
  assert.equal(results[2].remaining, 0);
});

test("checkRateLimit keeps keys independent", () => {
  resetRateLimitBuckets();
  checkRateLimit("a", 1);
  checkRateLimit("a", 1);
  assert.equal(checkRateLimit("b", 1).ok, true);
});

test("checkRateLimit resets after the window", () => {
  resetRateLimitBuckets();
  checkRateLimit("k2", 1, 0);
  const afterWindow = checkRateLimit("k2", 1, 1);
  // windowMs=0 means the first bucket already expired when measured
  assert.equal(afterWindow.ok, true);
});

test("apiRateLimitPerMinute defaults to 60 and honors env", () => {
  const prev = process.env.API_RATE_LIMIT_PER_MIN;
  try {
    delete process.env.API_RATE_LIMIT_PER_MIN;
    assert.equal(apiRateLimitPerMinute(), 60);
    process.env.API_RATE_LIMIT_PER_MIN = "5";
    assert.equal(apiRateLimitPerMinute(), 5);
    process.env.API_RATE_LIMIT_PER_MIN = "bogus";
    assert.equal(apiRateLimitPerMinute(), 60);
  } finally {
    if (prev === undefined) delete process.env.API_RATE_LIMIT_PER_MIN;
    else process.env.API_RATE_LIMIT_PER_MIN = prev;
  }
});
