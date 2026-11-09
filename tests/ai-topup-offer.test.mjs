import assert from "node:assert/strict";
import test from "node:test";
import { loadTs } from "./image-test-helpers.mjs";

const { AI_TOPUP_OFFER, getAITopupPackage, assertAITopupCheckoutEnabled } = loadTs("lib/ai-topup-offer.ts");

test("top-up catalog preserves the three approved one-time GBP packages", () => {
  assert.equal(AI_TOPUP_OFFER.currency, "gbp");
  assert.deepEqual(getAITopupPackage("starter"), { pricePence: 500, credits: 25 });
  assert.deepEqual(getAITopupPackage("popular"), { pricePence: 900, credits: 50 });
  assert.deepEqual(getAITopupPackage("power"), { pricePence: 1500, credits: 100 });
});

test("unfinished top-ups cannot be enabled or resolved through a prototype key", () => {
  assert.equal(AI_TOPUP_OFFER.checkoutEnabled, false);
  assert.throws(() => assertAITopupCheckoutEnabled(), /unavailable/);
  assert.throws(() => getAITopupPackage("__proto__"), /Unknown/);
  assert.throws(() => getAITopupPackage("other"), /Unknown/);
});
