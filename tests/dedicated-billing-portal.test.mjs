import assert from "node:assert/strict";
import test from "node:test";
import { loadTs } from "./image-test-helpers.mjs";

const unavailable = "Billing management is temporarily unavailable. Your subscription has not been changed.";
const { BillingCustomerUnavailableError } = loadTs("lib/stripe-rest.ts");
const env = {
  stripeSecretKey: "offline", stripePortalConfigurationId: "bpc_getcontentos",
  stripeLitePriceId: "price_lite", stripeProCreatorPriceId: "price_creator",
  stripeProStudioPriceId: "price_studio", appUrl: "https://example.invalid",
  stripeLegacyProCreatorPriceIds: [], stripeLegacyProStudioPriceIds: []
};
function configuration() {
  return {
    id: env.stripePortalConfigurationId, active: true, is_default: false,
    metadata: { application: "getcontentos" },
    features: {
      subscription_update: {
        enabled: true, default_allowed_updates: ["price"],
        products: ["lite", "creator", "studio"].map(plan => ({
          product: `prod_${plan}`, prices: [`price_${plan}`], adjustable_quantity: { enabled: false }
        })),
        proration_behavior: "create_prorations", billing_cycle_anchor: "unchanged",
        trial_update_behavior: "continue_trial", schedule_at_period_end: { conditions: [] }
      },
      subscription_cancel: { enabled: true, mode: "at_period_end", proration_behavior: "none" },
      payment_method_update: { enabled: true }, invoice_history: { enabled: true }
    }
  };
}
function adapter(config = configuration(), overrides = {}, failAt, suspended = false, customer = { id: "cus_own" }) {
  const calls = [];
  const api = loadTs("lib/stripe-rest.ts", {
    "@/lib/lite-availability": { LITE_PURCHASES_SUSPENDED: suspended },
    "@/lib/env": { getEnv: () => ({ ...env, ...overrides }), isStripeConfigured: () => true }
  }, new Map(), { fetch: async (url, init) => {
    calls.push({ url: new URL(url), ...init });
    if (init.method === failAt) return Response.json({ error: { message: "Private provider detail" } }, { status: 400 });
    if (new URL(url).pathname.startsWith("/v1/customers/")) return Response.json(customer);
    return Response.json(init.method === "GET" ? config : { url: "https://billing.stripe.com/synthetic" });
  } });
  return { api, calls, create: () => api.createCustomerPortalSession({ customerId: "cus_own" }) };
}

test("portal validates expanded dedicated catalogue and explicitly selects it for the session", async () => {
  const h = adapter();
  assert.deepEqual(await h.create(), { url: "https://billing.stripe.com/synthetic" });
  assert.equal(h.calls.length, 3);
  assert.equal(h.calls[0].url.pathname, "/v1/customers/cus_own");
  assert.equal(h.calls[1].method, "GET");
  assert.equal(h.calls[1].url.pathname, "/v1/billing_portal/configurations/bpc_getcontentos");
  assert.equal(h.calls[1].url.searchParams.get("expand[]"), "features.subscription_update.products");
  assert.equal(h.calls[1].cache, "no-store");
  assert.equal(h.calls[2].method, "POST");
  assert.equal(h.calls[2].url.pathname, "/v1/billing_portal/sessions");
  assert.deepEqual(Object.fromEntries(h.calls[2].body), {
    customer: "cus_own", configuration: "bpc_getcontentos", return_url: "https://example.invalid/dashboard"
  });
});

test("missing or invalid dedicated ID and missing or duplicate price mappings fail before Stripe", async () => {
  for (const overrides of [
    { stripePortalConfigurationId: "" }, { stripePortalConfigurationId: undefined },
    { stripePortalConfigurationId: "bpc_wrong/path" }, { stripeLitePriceId: "" },
    { stripeProStudioPriceId: "price_creator" }
  ]) {
    const h = adapter(configuration(), overrides);
    await assert.rejects(h.create, { message: unavailable });
    assert.equal(h.calls.length, 0);
  }
});

const invalidConfigurations = {
  "account-wide default": c => { c.is_default = true; },
  "wrong configuration": c => { c.id = "bpc_other"; },
  "inactive configuration": c => { c.active = false; },
  "unrelated application": c => { c.metadata.application = "taskpilot-ai"; },
  "disabled switching": c => { c.features.subscription_update.enabled = false; },
  "quantity changes": c => { c.features.subscription_update.default_allowed_updates.push("quantity"); },
  "promotion changes": c => { c.features.subscription_update.default_allowed_updates.push("promotion_code"); },
  "adjustable quantity": c => { c.features.subscription_update.products[0].adjustable_quantity.enabled = true; },
  "TaskPilot price": c => { c.features.subscription_update.products[0].prices = ["price_taskpilot"]; },
  "additional product": c => { c.features.subscription_update.products.push({ product: "prod_other", prices: ["price_other"] }); },
  "missing product": c => { c.features.subscription_update.products.pop(); },
  "duplicate product": c => { c.features.subscription_update.products[0].product = "prod_creator"; },
  "duplicate price": c => { c.features.subscription_update.products[0].prices = ["price_creator"]; },
  "unexpanded catalogue": c => { delete c.features.subscription_update.products; },
  "immediate invoice": c => { c.features.subscription_update.proration_behavior = "always_invoice"; },
  "reset invoice anchor": c => { c.features.subscription_update.billing_cycle_anchor = "now"; },
  "end trial early": c => { c.features.subscription_update.trial_update_behavior = "end_trial"; },
  "scheduled switch": c => { c.features.subscription_update.schedule_at_period_end.conditions = [{ type: "decreasing_item_amount" }]; },
  "immediate cancellation": c => { c.features.subscription_cancel.mode = "immediately"; },
  "cancellation proration": c => { c.features.subscription_cancel.proration_behavior = "create_prorations"; },
  "disabled cancellation": c => { c.features.subscription_cancel.enabled = false; },
  "disabled payment management": c => { c.features.payment_method_update.enabled = false; },
  "disabled invoices": c => { c.features.invoice_history.enabled = false; }
};
for (const [name, mutate] of Object.entries(invalidConfigurations)) {
  test(`portal fails closed for ${name}, without creating a default session`, async () => {
    const c = configuration(); mutate(c);
    const h = adapter(c);
    await assert.rejects(h.create, { message: unavailable });
    assert.equal(h.calls.length, 2);
    assert.equal(h.calls[0].method, "GET");
  });
}

test("provider errors are redacted and never retried or replaced with the default portal", async () => {
  for (const method of ["GET", "POST"]) {
    const h = adapter(configuration(), {}, method);
    await assert.rejects(h.create, { message: unavailable });
    assert.equal(h.calls.length, method === "GET" ? 1 : 3);
  }
});

function route({ user = { id: "account-a", email: "a@example.invalid" }, customer = "cus_own", failure = false } = {}) {
  const calls = [];
  const { POST } = loadTs("app/api/billing/portal/route.ts", {
    "server-only": {},
    "next/server": { NextResponse: Response }, "@/lib/backend": { usesPostgres: () => true },
    "@/lib/auth": { getCurrentUser: async () => user },
    "@/lib/repository": { getUserProfileForUser: async (id, email) => {
      calls.push({ id, email }); return { stripe_customer_id: customer };
    } },
    "@/lib/stripe-rest": { BillingCustomerUnavailableError, createCustomerPortalSession: async input => {
      calls.push(input);
      if (failure === "deleted") throw new BillingCustomerUnavailableError();
      if (failure) throw new Error("Private provider error");
      return { url: "https://billing.stripe.com/synthetic" };
    } }
  });
  return { calls, send: (origin = "https://getcontentos.co") => POST(new Request("https://getcontentos.co/api/billing/portal", {
    method: "POST", headers: { origin, "content-type": "application/json" },
    body: JSON.stringify({ customerId: "cus_other", configuration: "bpc_taskpilot" })
  })) };
}

test("portal uses authenticated account customer, never browser-supplied customer or configuration", async () => {
  const h = route();
  assert.equal((await h.send()).status, 200);
  assert.deepEqual(h.calls, [{ id: "account-a", email: "a@example.invalid" }, { customerId: "cus_own" }]);
});

test("portal preserves origin, authentication and missing-customer guards", async () => {
  const foreign = route(); assert.equal((await foreign.send("https://attacker.invalid")).status, 403);
  assert.equal(foreign.calls.length, 0);
  const anonymous = route({ user: null }); assert.equal((await anonymous.send()).status, 401);
  assert.equal(anonymous.calls.length, 0);
  const missing = route({ customer: null }); assert.equal((await missing.send()).status, 404);
  assert.equal(missing.calls.length, 1);
});

test("portal configuration failure gives a safe 503 without claiming a subscription change", async () => {
  const h = route({ failure: true }); const response = await h.send();
  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), { error: unavailable });
  assert.equal(h.calls.length, 2);
});

test("captured deleted customer is not sent to portal creation or automatically replaced", async () => {
  const h = adapter(configuration(), {}, undefined, false, { id: "cus_own", deleted: true });
  await assert.rejects(h.create, { name: "BillingCustomerUnavailableError" });
  assert.equal(h.calls.length, 1);
  const response = await route({ failure: "deleted" }).send();
  assert.equal(response.status, 409);
  assert.match((await response.json()).error, /existing access has not changed/);
});

test("suspended Lite cannot be selected in portal while current Lite recognition is preserved", async () => {
  const c = configuration(); c.features.subscription_update.products.shift();
  const h = adapter(c, {}, undefined, true);
  await h.create();
  assert.equal(h.calls.length, 3);
  assert.equal(h.api.stripeSubscriptionToState({status:"active",items:{data:[{price:{id:"price_lite"}}]}}).plan, "lite");
  await assert.rejects(adapter(configuration(), {}, undefined, true).create, {message:unavailable});
});

test("customer lookup distinguishes resource_missing from permission failures and outages", async () => {
  for (const status of [404, 403, 500]) {
    let calls = 0;
    const api = loadTs("lib/stripe-rest.ts", {"@/lib/env":{getEnv:()=>env,isStripeConfigured:()=>true}},new Map(),{
      fetch:async()=>{calls++;return Response.json({error:{code:"resource_missing",message:"Private"}},{status});}
    });
    if(status===404) assert.equal(await api.stripeCustomerIsAvailable("cus_own"),false);
    else await assert.rejects(()=>api.stripeCustomerIsAvailable("cus_own"));
    assert.equal(calls,1);
  }
});
