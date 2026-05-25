import assert from "node:assert/strict";

const { cleanPlainText } = await import("../lib/text-normalize.ts");
const { buildUsageSummary, monthlyLimitForPlan } = await import("../lib/usage.ts");
const {
  buildSocialPosterContent,
  buildTextlessBackgroundPrompt,
  renderSocialPosterSvg,
  svgToDataUrl
} = await import("../lib/social-image.ts");

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

const posterContent = buildSocialPosterContent({
  outputText:
    "Founders: clear content compounds faster than scattered posting.\n\nUse one strong idea, then turn it into platform-ready assets without losing the point.\n\nCTA: Start with the idea that already matters.\n\n#founders #contentstrategy #growth",
  platform: "LinkedIn",
  contentType: "LinkedIn post",
  style: "premium",
  format: "square",
  brandContext: {
    brandName: "ContentOS",
    audience: "Founders and consultants",
    offer: "AI content workflow",
    brandVoice: "clear and authoritative",
    contentGoal: "build authority"
  }
});

assert.equal(posterContent.footer, "ContentOS");
assert.ok(posterContent.headline.includes("Founders"));
assert.deepEqual(posterContent.hashtags, ["#founders", "#contentstrategy", "#growth"]);

const backgroundPrompt = buildTextlessBackgroundPrompt({
  outputText: "This exact post text must never be rendered by the image model.",
  platform: "LinkedIn",
  contentType: "LinkedIn post",
  style: "premium",
  format: "square",
  brandContext: {}
});

assert.ok(backgroundPrompt.includes("no text"));
assert.ok(backgroundPrompt.includes("no letters"));
assert.ok(!backgroundPrompt.includes("This exact post text"));

const rendered = renderSocialPosterSvg({
  content: posterContent,
  style: "premium",
  format: "square"
});

assert.equal(rendered.size, "1080x1080");
assert.ok(rendered.svg.includes("#founders"));
assert.ok(!rendered.svg.includes("<foreignObject"));
assert.ok(svgToDataUrl(rendered.svg).startsWith("data:image/svg+xml"));

console.log("ContentOS content, usage, and social image checks passed.");
