import assert from "node:assert/strict";
import test from "node:test";
import { loadTs } from "./image-test-helpers.mjs";

const { PAID_LIFETIME_OFFER, lifetimePriceForCompletedSales, lifetimePlacesRemaining } = loadTs("lib/paid-lifetime-offer.ts");

test("new paid lifetime identity cannot be mistaken for retired Founding 100", () => {
  assert.notEqual(PAID_LIFETIME_OFFER.code, "founder");
  assert.notEqual(PAID_LIFETIME_OFFER.code, "FOUNDING100");
  assert.equal(PAID_LIFETIME_OFFER.checkoutEnabled, false);
  assert.equal(PAID_LIFETIME_OFFER.monthlyTextGenerations, 50);
  assert.equal(PAID_LIFETIME_OFFER.monthlyAiImages, 0);
});

test("first 25 completed purchases get £99 and later buyers £149", () => {
  assert.equal(lifetimePriceForCompletedSales(0), 9900);
  assert.equal(lifetimePriceForCompletedSales(24), 9900);
  assert.equal(lifetimePriceForCompletedSales(25), 14900);
  assert.equal(lifetimePriceForCompletedSales(100), 14900);
  assert.equal(lifetimePlacesRemaining(24), 1);
  assert.equal(lifetimePlacesRemaining(25), 0);
  for (const invalid of [-1, 0.5, Number.NaN, Number.MAX_SAFE_INTEGER + 1]) {
    assert.throws(() => lifetimePriceForCompletedSales(invalid), RangeError);
  }
});
