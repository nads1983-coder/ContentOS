import test from "node:test";
import assert from "node:assert/strict";
import { createImageHarness, imageInput, requestId, PNG } from "./image-test-helpers.mjs";
const { Response, DOMException, AbortController } = globalThis;

const count = (h, name) => h.calls.filter(call => call === name).length;
const creditCount = h => Object.values(h.data.image_generation_usage_json ?? {}).reduce((a, b) => a + b, 0);
const different = n => imageInput({ requestId: requestId(n), outputText: `Distinct original source ${n}` });
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };

test("image auth and account ownership reject before reading body or touching storage", async () => {
  for (const [options, account, status] of [[{ anonymous: true }, null, 401], [{}, null, 409], [{}, "", 409], [{}, "stale-account", 409]]) {
    const h = createImageHarness(options), result = await h.post(undefined, { account, rawBody: "{" });
    assert.equal(result.response.status, status);
    assert.deepEqual(h.calls, []);
    assert.equal(result.bodyRead, false);
    assert.equal(h.data.image_generation_reservations_json, undefined);
    if (status === 409) {
      assert.equal(result.body.code, "account_changed");
      assert.match(result.body.error, /Reload the page or sign in again/);
      assert.ok(!JSON.stringify(result.body).includes("user-test"));
    }
  }
});

test("missing storage, profiles, invalid inputs and ineligible plans never reach AI", async () => {
  for (const [options, input, status] of [[{ noDatabase: true }, imageInput(), 503], [{ noProfile: true }, imageInput(), 403],
    [{ profile: { plan: "free" } }, imageInput(), 403], [{ profile: { subscription_status: "canceled" } }, imageInput(), 403],
    [{ profile: { subscription_current_period_end: "2000-01-01T00:00:00Z" } }, imageInput(), 403],
    [{}, imageInput({ requestId: undefined }), 400], [{}, imageInput({ outputText: "x".repeat(2601) }), 400]]) {
    const h = createImageHarness(options), result = await h.post(input);
    assert.equal(result.response.status, status);
    assert.equal(count(h, "provider"), 0);
    assert.equal(count(h, "complete"), 0);
    assert.equal(h.data?.image_generation_reservations_json, undefined);
  }
});

test("malformed usage and admission transaction failure fail closed without provider spend", async () => {
  for (const options of [{ profile: { image_generation_usage_json: { invalid: -1 } } }, { profile: { usage_events_json: "invalid" } }, { fault: "reserve-before" }]) {
    const h = createImageHarness(options), result = await h.post();
    assert.equal(result.response.status, 503);
    assert.equal(count(h, "provider"), 0);
    assert.equal(h.data.image_generation_reservations_json, undefined);
  }
});

test("actual SVG renderer preserves all four formats; success replays exactly without another AI call or charge", async () => {
  for (const [format, size] of [["square", "1080x1080"], ["landscape", "1536x864"], ["portrait", "1080x1350"], ["vertical", "1080x1920"]]) {
    const h = createImageHarness(), input = imageInput({ format });
    const first = await h.post(input);
    assert.equal(first.response.status, 200);
    assert.equal(first.body.size, size);
    assert.equal(first.body.creditCharged, true);
    assert.match(decodeURIComponent(first.body.image), /data:image\/png;base64,/);
    assert.equal(first.response.headers.get("cache-control"), "private, no-store");
    assert.equal(first.response.headers.get("x-request-id"), input.requestId);
    const replay = await h.post(input);
    assert.equal(replay.response.status, 200);
    assert.deepEqual(replay.body, first.body);
    assert.equal(count(h, "provider"), 1);
    assert.equal(count(h, "complete"), 1);
    assert.equal(creditCount(h), 1);
    assert.equal(h.data.usage_events_json.length, 1);
    assert.equal(h.data.image_generation_attempts_json.count, 1);
    assert.ok(!JSON.stringify(h.data.usage_events_json).includes("base64"));
    assert.equal((await h.post(imageInput({ format, outputText: "edited input" }))).body.code, "request_mismatch");
  }
});

test("provider rejection, timeout, malformed response and URL-only output fall back once with no AI credit", async () => {
  for (const provider of [async () => new Response("private provider data", { status: 500 }), async () => new Response("private", { status: 429 }),
    async () => { throw new DOMException("private source text", "TimeoutError"); }, async () => Response.json({ data: [{ url: "http://internal.invalid" }] }),
    async () => Response.json({ data: [{ b64_json: "invalid" }] }), async () => new Response("{"),
    async () => new Response(" ".repeat(5_000_001))]) {
    const h = createImageHarness({ provider }), first = await h.post();
    assert.equal(first.response.status, 200);
    assert.equal(first.body.creditCharged, false);
    assert.match(first.body.image, /^data:image\/svg\+xml/);
    assert.match(first.body.warning, /No successful image credit was recorded/);
    assert.match(first.body.warning, /uncertain request may remain reserved/);
    assert.equal(creditCount(h), 0);
    assert.equal(h.data.usage_events_json, undefined);
    assert.equal(h.data.image_generation_attempts_json.count, 1);
    assert.deepEqual((await h.post()).body, first.body);
    assert.equal(count(h, "provider"), 1);
    assert.ok(!JSON.stringify(h.warnings).includes("private"));
  }
});

test("unconfigured provider produces a durable free template with zero network calls", async () => {
  const h = createImageHarness({ noKey: true }), first = await h.post();
  assert.equal(first.response.status, 200);
  assert.equal(first.body.creditCharged, false);
  assert.match(first.body.warning, /not configured/);
  assert.deepEqual((await h.post()).body, first.body);
  assert.equal(count(h, "provider"), 0);
  assert.equal(creditCount(h), 0);
});

test("an oversized encoded AI result becomes a bounded free SVG instead of an unbounded profile value", async () => {
  // A valid PNG prefix followed by slash-heavy base64 expands when SVG is URL-encoded.
  const png = PNG.slice(0, 12) + "/".repeat(2_000_000);
  const h = createImageHarness({ provider: async () => Response.json({ data: [{ b64_json: png }] }) });
  const result = await h.post();
  assert.equal(result.response.status, 200);
  assert.equal(result.body.creditCharged, false);
  assert.match(result.body.warning, /too large to save/);
  assert.ok(JSON.stringify(result.body).length < 100_000);
  assert.equal(creditCount(h), 0);
  assert.equal(h.data.image_generation_attempts_json.count, 1);
});

test("route diagnostics contain only fixed categories, never source, brand, account or provider errors", async () => {
  const privateInput = imageInput({ outputText: "customer-private-source", brandContext: { brandName: "private-brand" } });
  for (const options of [{ fault: "reserve-before" }, { fault: "complete-after" }, { renderError: true, fault: "fail-before" }]) {
    const h = createImageHarness(options);
    await h.post(privateInput);
    for (const warning of h.warnings) {
      assert.equal(warning.length, 1);
      assert.ok(["[image] admission unavailable", "[image] completion uncertain", "[image] reservation release unavailable"].includes(warning[0]));
    }
    assert.doesNotMatch(JSON.stringify(h.warnings), /customer-private-source|private-brand|user-test|example.invalid|Commit failed|acknowledgement/);
  }
});

test("failed rendering releases exactly once and leaves terminal identity, not a successful credit", async () => {
  const h = createImageHarness({ renderError: true });
  assert.equal((await h.post()).response.status, 502);
  assert.equal(count(h, "fail"), 1);
  assert.equal(count(h, "complete"), 0);
  assert.equal(h.data.image_generation_reservations_json.length, 0);
  assert.equal(h.data.image_generation_attempts_json.count, 1);
  assert.equal(creditCount(h), 0);
  assert.equal((await h.post()).body.code, "request_failed");
  assert.equal(count(h, "provider"), 1);
  assert.equal(count(h, "fail"), 1);
});

test("uncertain release keeps reservation and blocks retry without a second provider call", async () => {
  const h = createImageHarness({ renderError: true, fault: "fail-before" });
  assert.equal((await h.post()).response.status, 502);
  assert.equal(h.data.image_generation_reservations_json[0].status, "reserved");
  h.fault = undefined;
  assert.equal((await h.post()).body.code, "request_in_progress");
  assert.equal(count(h, "provider"), 1);
  assert.equal(creditCount(h), 0);
});

test("lost reservation acknowledgement cannot start AI and the same ID remains blocked", async () => {
  const h = createImageHarness({ fault: "reserve-after" });
  assert.equal((await h.post()).response.status, 503);
  h.fault = undefined;
  assert.equal((await h.post()).body.code, "request_in_progress");
  assert.equal(count(h, "provider"), 0);
  assert.equal(h.data.image_generation_attempts_json.count, 1);
});

test("completion failure before persistence preserves pending hold without release or provider retry", async () => {
  const h = createImageHarness({ fault: "complete-before" }), first = await h.post();
  assert.equal(first.response.status, 503);
  assert.equal(first.body.code, "image_save_uncertain");
  assert.equal(h.data.image_generation_reservations_json[0].status, "reserved");
  assert.equal(creditCount(h), 0);
  assert.equal(count(h, "fail"), 0);
  h.fault = undefined;
  assert.equal((await h.post()).body.code, "request_in_progress");
  assert.equal(count(h, "provider"), 1);
});

test("lost completion acknowledgement replays durable result with exactly one credit", async () => {
  const h = createImageHarness({ fault: "complete-after" }), first = await h.post();
  assert.equal(first.body.code, "image_save_uncertain");
  assert.equal(h.data.image_generation_reservations_json[0].status, "completed");
  h.fault = undefined;
  const replay = await h.post();
  assert.equal(replay.response.status, 200);
  assert.deepEqual(replay.body, h.data.image_generation_reservations_json[0].result);
  assert.equal(creditCount(h), 1);
  assert.equal(count(h, "provider"), 1);
  assert.equal(count(h, "fail"), 0);
});

test("locked admission serializes identical concurrent requests even when request IDs differ", async () => {
  const entered = deferred(), release = deferred();
  const h = createImageHarness({ provider: async () => { entered.resolve(); await release.promise; return Response.json({ data: [{ b64_json: PNG }] }); } });
  const first = h.post();
  await entered.promise;
  assert.equal((await h.post()).body.code, "request_in_progress");
  assert.equal((await h.post(imageInput({ requestId: requestId(2) }))).body.code, "duplicate_in_progress");
  assert.equal(count(h, "provider"), 1);
  release.resolve();
  assert.equal((await first).response.status, 200);
  assert.equal(creditCount(h), 1);
});

test("locked last-credit admission lets only one of concurrent distinct requests reach AI", async () => {
  const now = new Date(), start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
  const entered = deferred(), release = deferred();
  const h = createImageHarness({ profile: { image_generation_usage_json: { [start]: 99 } }, provider: async () => {
    entered.resolve(); await release.promise; return Response.json({ data: [{ b64_json: PNG }] });
  } });
  const first = h.post();
  await entered.promise;
  assert.equal((await h.post(different(2))).body.code, "image_quota_exceeded");
  release.resolve();
  assert.equal((await first).response.status, 200);
  assert.equal(creditCount(h), 100);
  assert.equal((await h.post(different(3))).body.code, "image_quota_exceeded");
  assert.equal(count(h, "provider"), 1);
});

test("two active distinct images block a third and completion releases concurrency capacity", async () => {
  const entered = deferred(), release = deferred();
  let entries = 0;
  const h = createImageHarness({ provider: async () => { if (++entries === 2) entered.resolve(); await release.promise; return Response.json({ data: [{ b64_json: PNG }] }); } });
  const first = h.post(), second = h.post(different(2));
  await entered.promise;
  const denied = await h.post(different(3));
  assert.equal(denied.body.code, "image_concurrency_limit");
  assert.ok(Number(denied.response.headers.get("retry-after")) > 0);
  assert.ok(Number(denied.response.headers.get("retry-after")) <= 900);
  release.resolve();
  assert.deepEqual((await Promise.all([first, second])).map(v => v.response.status), [200, 200]);
  assert.equal((await h.post(different(3))).response.status, 200);
  assert.equal(creditCount(h), 3);
});

test("durable attempt budget prevents new-ID provider abuse after six refunded failures", async () => {
  const h = createImageHarness({ renderError: true });
  for (let i = 1; i <= 6; i++) assert.equal((await h.post(different(i))).response.status, 502);
  const denied = await h.post(different(7));
  assert.equal(denied.body.code, "image_attempt_limit");
  assert.ok(Number(denied.response.headers.get("retry-after")) > 0);
  assert.ok(Number(denied.response.headers.get("retry-after")) <= 600);
  assert.equal(count(h, "provider"), 6);
  assert.equal(h.data.image_generation_attempts_json.count, 6);
  assert.equal(creditCount(h), 0);
});

test("image usage summaries take the durable/event maximum without changing text or double-counting totals", async () => {
  const now = new Date(), start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
  const events = (type, count) => Array.from({ length: count }, () => ({ event_type: type, created_at: now.toISOString() }));
  const h = createImageHarness({ profile: {
    generation_usage_json: { [start]: 9 }, image_generation_usage_json: { [start]: 7 },
    usage_events_json: [...events("text_generation", 2), ...events("image_generation", 3), ...events("other", 1)],
    generation_history_json: events("text_generation", 11)
  } });
  const countUsage = eventType => h.repository.getMonthlyUsageCount({ userId: "user-test", eventType });
  assert.equal(await countUsage("image_generation"), 7);
  assert.equal(await countUsage("text_generation"), 11);
  assert.equal(await countUsage(), 19);
  h.data = { ...h.data, image_generation_usage_json: { [start]: 2 } };
  assert.equal(await countUsage("image_generation"), 3);
  assert.equal(await countUsage(), 15);
  h.data = { ...h.data, image_generation_usage_json: { [start]: 7 }, usage_events_json: [], generation_history_json: [] };
  assert.equal(await countUsage("image_generation"), 7);
  assert.equal(await countUsage("text_generation"), 9);
  assert.equal(await countUsage(), 16);
});

test("locked admission serializes the final rolling attempt slot across distinct new IDs", async () => {
  const now = new Date(), entered = deferred(), release = deferred();
  const h = createImageHarness({
    profile: { image_generation_attempts_json: { day: now.toISOString().slice(0, 10), count: 5, recent: Array(5).fill(now.toISOString()) } },
    provider: async () => { entered.resolve(); await release.promise; return Response.json({ data: [{ b64_json: PNG }] }); }
  });
  const first = h.post();
  await entered.promise;
  assert.equal((await h.post(different(2))).body.code, "image_attempt_limit");
  assert.equal(h.data.image_generation_attempts_json.count, 6);
  release.resolve();
  assert.equal((await first).response.status, 200);
  assert.equal(count(h, "provider"), 1);
});

test("request IDs are scoped to the authenticated account, never another user's replay", async () => {
  const h = createImageHarness();
  await h.post();
  h.userId = "other-user";
  assert.equal((await h.post(undefined, { account: "user-test" })).body.code, "account_changed");
  assert.equal((await h.post()).response.status, 200);
  assert.equal(count(h, "provider"), 2);
  assert.equal(h.rows.get("other-user").usage_events_json[0].user_id, "other-user");
  assert.equal(h.data.usage_events_json[0].user_id, "user-test");
});

test("client cancellation releases the hold and never records successful usage", async () => {
  const controller = new AbortController();
  controller.abort();
  const h = createImageHarness();
  assert.equal((await h.post(undefined, { signal: controller.signal })).response.status, 502);
  assert.equal(count(h, "provider"), 0);
  assert.equal(count(h, "fail"), 1);
  assert.equal(creditCount(h), 0);
});
