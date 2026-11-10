import test from "node:test";
import assert from "node:assert/strict";
import {loadTs} from "./image-test-helpers.mjs";
const capacity=loadTs("lib/paid-lifetime-capacity.ts");
const {COST_POLICY}=loadTs("lib/ai-cost.ts");
test("current shared budget cannot fund even one worst-case lifetime allowance",()=>{
  assert.equal(capacity.lifetimeMonthlyLiability(),34_030_100);
  assert.equal(COST_POLICY.monthly,30_000_000);
  assert.equal(capacity.fundedLifetimePlaces(0,0,new Date("2026-11-08")),0);
  assert.equal(capacity.LIFETIME_CAPACITY.protectedMonthlyMicroGBP,30_000_000);
  assert.throws(()=>capacity.assertLifetimeCapacity(0),/funded monthly capacity/);
  assert.equal(capacity.fundedLifetimePlaces(-1,0),0);
  assert.equal(capacity.fundedLifetimePlaces(0,0,new Date("2026-11-20")),0);
});
