import assert from "node:assert/strict";
import test from "node:test";
import { loadTs } from "./image-test-helpers.mjs";

const { hasPaidCreatorLifetimeEntitlement, paidCreatorLifetimeIsPrimary, hasLifetimeEntitlement } = loadTs("lib/entitlements.ts");
const lifetime = { id: "u1", plan: "free", subscription_status: "none",
  paid_creator_lifetime_purchase_id: "purchase-id", paid_creator_lifetime_status: "active" };

test("paid lifetime access is separate from retired Founder and recurring billing", () => {
  assert.equal(hasPaidCreatorLifetimeEntitlement(lifetime), true);
  assert.equal(hasLifetimeEntitlement(lifetime), false);
  assert.equal(paidCreatorLifetimeIsPrimary(lifetime), true);
  assert.equal(hasPaidCreatorLifetimeEntitlement({ ...lifetime, paid_creator_lifetime_purchase_id: null }), false);
  for (const status of ["refunded", "disputed", null]) {
    assert.equal(paidCreatorLifetimeIsPrimary({ ...lifetime, paid_creator_lifetime_status: status }), false);
  }
});

test("active Pro Studio subscription wins until expiry; lifetime Creator then takes over", () => {
  const profile = { ...lifetime, plan: "pro_studio", subscription_status: "active",
    subscription_current_period_end: "2026-12-01T00:00:00.000Z" };
  assert.equal(paidCreatorLifetimeIsPrimary(profile, new Date("2026-11-08")), false);
  assert.equal(paidCreatorLifetimeIsPrimary(profile, new Date("2026-12-02")), true);
  assert.equal(paidCreatorLifetimeIsPrimary({ ...profile, subscription_status: "canceled" }, new Date("2026-11-08")), true);
});
