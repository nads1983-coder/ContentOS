import assert from "node:assert/strict";

const { cleanPlainText } = await import("../lib/text-normalize.ts");
const { buildUsageSummary, monthlyLimitForPlan } = await import("../lib/usage.ts");

const encoded = "Founders%3A%20Start%20here%0A%0A%23growth";
assert.equal(cleanPlainText(encoded), "Founders: Start here\n\n#growth");

const html = '<a href="https://example.com">Founders</a><br><strong>Build</strong>';
assert.equal(cleanPlainText(html), "Founders\nBuild");

const freeUsage = buildUsageSummary("free", 1);
assert.equal(freeUsage.limit, 3);
assert.equal(freeUsage.used, 1);
assert.equal(freeUsage.remaining, 2);

assert.equal(monthlyLimitForPlan("pro_creator"), 100);
assert.equal(monthlyLimitForPlan("pro_studio"), 500);

console.log("ContentOS content and usage checks passed.");
