import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import ts from "typescript";
import { createElement } from "react";
import * as jsxRuntime from "react/jsx-runtime";
import { renderToStaticMarkup } from "react-dom/server";
import { loadTs } from "./image-test-helpers.mjs";

const stripe = loadTs("lib/stripe-rest.ts", { "@/lib/env": { getEnv: () => ({}) } });
const { outputText } = ts.transpileModule(readFileSync("app/dashboard/page.tsx", "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX }
});
async function renderDashboard(overrides = {}, customerAvailable) {
  const profile = {
    id: "synthetic", email: "qa@example.invalid", plan: "lite", subscription_status: "active",
    subscription_current_period_end: "2026-12-01T12:00:00.000Z",
    subscription_cancel_at_period_end: false, ...overrides
  };
  const mocks = {
    "react/jsx-runtime": jsxRuntime,
    "next/navigation": { redirect: () => { throw new Error("Unexpected redirect"); } },
    "next/link": { __esModule: true, default: ({ children, ...props }) => createElement("a", props, children) },
    "@/components/brand-logo": { BrandLogo: () => null },
    "@/components/billing-buttons": { CheckoutButton: () => null, ManageBillingButton: () => createElement("button", null, "Manage subscription") },
    "@/components/logout-button": { LogoutButton: () => null },
    "@/lib/auth": { getCurrentUser: async () => ({ id: profile.id, email: profile.email }) },
    "@/lib/backend": { isDatabaseConfigured: () => true, usesPostgres: () => true },
    "@/lib/env": { isStripeConfigured: () => customerAvailable !== undefined },
    "@/lib/stripe-rest": {...stripe,stripeCustomerIsAvailable:async()=>customerAvailable},
    "@/lib/entitlements": loadTs("lib/entitlements.ts"),
    "@/lib/usage": loadTs("lib/usage.ts"),
    "@/lib/repository": {
      getUserProfileForUser: async () => profile, listBrandProfiles: async () => [],
      getMonthlyUsageCount: async () => 2, getWorkspace: async () => ({ store: { recent: [] } })
    }
  };
  const module = { exports: {} };
  new Function("require", "module", "exports", outputText)(id => {
    assert.ok(Object.hasOwn(mocks, id), `Unmocked dependency ${id}`);
    return mocks[id];
  }, module, module.exports);
  return renderToStaticMarkup(await module.exports.default());
}

test("dashboard uses explicit cancellation date, not renewal date or cancellation initiation", async () => {
  const html = await renderDashboard({ subscription_cancel_at_period_end: true,
    subscription_cancel_at: "2026-11-16T12:00:00.000Z", subscription_canceled_at: "2026-11-01T12:00:00.000Z" });
  assert.match(html, /active \/ cancellation scheduled/);
  assert.match(html, /Paid until: 16 Nov 2026/);
  assert.match(html, /Cancellation pending\. Access remains active until 16 Nov 2026/);
  assert.doesNotMatch(html, /Renewal date:/);
});

test("deleted owner billing link is hidden without altering lifetime benefits; valid Founder billing stays available", async () => {
  const profile={plan:"pro_studio",entitlement_source:"owner_complimentary_lifetime",stripe_customer_id:"cus_deleted",subscription_current_period_end:null};
  const html=await renderDashboard(profile,false);
  assert.match(html,/Lifetime \/ no expiry/);
  assert.match(html,/no payment is required/);
  assert.doesNotMatch(html,/Manage subscription/);
  const valid=await renderDashboard({...profile,plan:"founder",entitlement_source:"founder_offer"},true);
  assert.match(valid,/Manage subscription/);
});

test("dashboard supports legacy period-end cancellation without a stored cancel_at", async () => {
  const html = await renderDashboard({ subscription_cancel_at_period_end: true });
  assert.match(html, /Paid until: 1 Dec 2026/);
  assert.match(html, /Cancellation pending/);
});

test("renewing and reversed subscriptions show renewal date without stale cancellation notice", async () => {
  for (const plan of ["lite", "pro_creator", "pro_studio"]) {
    const html = await renderDashboard({ plan, subscription_cancel_at: null, subscription_canceled_at: "2026-11-01T12:00:00.000Z" });
    assert.match(html, /Renewal date: 1 Dec 2026/);
    assert.doesNotMatch(html, /Cancellation pending|cancellation scheduled|Paid until:/);
  }
});

test("Founder and owner lifetime display ignores stale ordinary cancellation fields", async () => {
  for (const [plan, entitlement_source] of [["founder", "founder_offer"], ["pro_studio", "owner_complimentary_lifetime"]]) {
    const html = await renderDashboard({ plan, entitlement_source, subscription_current_period_end: null, subscription_cancel_at_period_end: true,
      subscription_cancel_at: "2026-11-16T12:00:00.000Z" });
    assert.match(html, /Access: Lifetime \/ no expiry/);
    assert.doesNotMatch(html, /Cancellation pending|cancellation scheduled|Renewal date:|Paid until:/);
  }
});
