import test from "node:test";
import assert from "node:assert/strict";
import { loadTs, createImageHarness, imageInput, PNG } from "./image-test-helpers.mjs";

const { buildSocialPosterContent, buildTextlessBackgroundPrompt, renderSocialPosterSvg } = loadTs("lib/social-image.ts");
const textNormalize = loadTs("lib/text-normalize.ts");
const outputFormat = loadTs("lib/output-format.ts", { "./text-normalize": textNormalize });
const { buildSectionCopyText } = loadTs("lib/copy.ts", { "./text-normalize": textNormalize, "./output-format": outputFormat });
const tags = "#ContentOS #ProductivityTools #CreatorEconomy #ContentCreation";
const section = {
  id: "synthetic-announcement", type: "linkedin", platform: "LinkedIn", title: "LinkedIn Announcement Post",
  body: `We listened to your needs. The upgrade brings a streamlined interface, smarter content workflows, and new ways to manage your creative process.\n\n${tags}`
};
const caption = buildSectionCopyText(section);
const fixture = () => imageInput({ outputText: caption, style: "premium", brandContext: {
  brandName: "Content OS", contentTopic: section.title, contentGoal: "announcement"
} });
const visibleText = svg => [...svg.matchAll(/>([^<>]*)</g)].map(match => match[1]).join(" ");
const hashtag = /[#＃][\p{L}\p{M}\p{N}_]+/u;

test("supplied LinkedIn announcement keeps caption hashtags but never overlays them or a goal in the footer", () => {
  const input = fixture(), original = structuredClone(input);
  const content = buildSocialPosterContent(input);
  const prompt = buildTextlessBackgroundPrompt(input);
  const { svg } = renderSocialPosterSvg({ ...input, content });
  assert.equal(content.headline, section.title);
  assert.equal(content.cta, "");
  assert.equal(Object.hasOwn(content, "hashtags"), false);
  assert.doesNotMatch(prompt, hashtag);
  assert.doesNotMatch(visibleText(svg), hashtag);
  assert.equal((visibleText(svg).match(/ContentOS/g) ?? []).length, 1);
  assert.doesNotMatch(visibleText(svg), /Content OS/);
  for (const tag of tags.split(" ")) assert.ok(buildSectionCopyText(section).includes(tag));
  assert.deepEqual(input, original);
});

test("every platform sanitises inline, labelled, Unicode and encoded hashtags in all image context fields", () => {
  for (const platform of ["LinkedIn", "Instagram", "Facebook", "TikTok", "YouTube", "X", "Pinterest", "Blog", "Carousel"]) {
    const contaminated = "Clear ideas #Marketing ＃Créativité #日本語 %23Encoded &#35;Entity &#x23;HexEntity";
    const input = imageInput({ platform: `${platform} #Platform`, contentType: `${platform} #Type`,
      outputText: `${contaminated}\n\nBody: Keep the useful caption words #Inline.\n\nCTA: Read more #CTA\n\nHashtags: #Footer #Only`,
      brandContext: Object.fromEntries(["brandName", "audience", "offer", "writingStyle", "contentGoal", "brandColors", "visualStyle", "contentTopic"].map(key => [key, contaminated]))
    });
    assert.doesNotMatch(buildTextlessBackgroundPrompt(input), hashtag, platform);
    const content = buildSocialPosterContent(input);
    assert.doesNotMatch(JSON.stringify(content), hashtag, platform);
    assert.doesNotMatch(visibleText(renderSocialPosterSvg({ ...input, content }).svg), hashtag, platform);
    assert.match(input.outputText, /#Inline/);
    assert.equal(content.cta, "Read more");
  }
});

test("fallback topic and direct template rendering are sanitised; palette hex values keep their meaning", () => {
  const input = imageInput({ contentType: "", outputText: "#OnlyTags", brandContext: { brandColors: "#000000, #fff, #7c3aed #Marketing" } });
  const prompt = buildTextlessBackgroundPrompt(input);
  assert.match(prompt, /hex 000000, hex fff, hex 7c3aed/);
  assert.doesNotMatch(prompt, hashtag);
  const content = { headline: "A clear title #Heading", body: "Useful words #Body", cta: "Call to action #CTA",
    footer: "Brand #Footer", hashtags: ["#LegacyOverlay"], template: "linkedin_graphic" };
  const { svg } = renderSocialPosterSvg({ ...input, content });
  assert.doesNotMatch(visibleText(svg), hashtag);
  assert.doesNotMatch(svg.match(/aria-label="([^"]*)"/)[1], hashtag);
  assert.match(visibleText(svg), /Useful words/);
  const fallback = buildSocialPosterContent(input);
  assert.ok(fallback.headline);
  assert.doesNotMatch(JSON.stringify(fallback), hashtag);
});

test("long allowed copy stays above the reserved branding footer for every canvas and style", () => {
  for (const format of ["square", "landscape", "portrait", "vertical"]) {
    for (const style of ["minimal", "premium", "corporate", "bold", "dark", "modern"]) {
      const input = fixture();
      input.format = format;
      input.style = style;
      input.platform = "Facebook";
      input.contentType = "Facebook Post";
      input.brandContext.contentTopic = "A compelling announcement about the newest tools for busy creative teams worldwide";
      input.outputText += "\n\nCTA: Discover how your next creative project could take shape with the tools you already enjoy";
      input.brandContext.brandName = "VeryLongUnbrokenBrandName".repeat(3);
      const { svg } = renderSocialPosterSvg({ ...input, content: buildSocialPosterContent(input) });
      const footerTop = Number(svg.match(/<line x1="[^"]+" y1="([^"]+)"/)[1]);
      for (const match of svg.matchAll(/<tspan x="[^"]+" y="([^"]+)"[^>]*>([^<]*)<\/tspan>/g)) {
        assert.ok(Number(match[1]) < footerTop - 20, `${format}/${style}: text must not overlap footer`);
      }
      assert.doesNotMatch(visibleText(svg), hashtag);
    }
  }
});

test("actual route sanitises provider prompts and graphics on mocked success and fallback, preserving caption and replay accounting", async () => {
  for (const fallback of [false, true]) {
    const input = fixture(), original = structuredClone(input);
    input.brandContext.audience = "Creators #CreatorEconomy";
    original.brandContext.audience = input.brandContext.audience;
    const h = createImageHarness({ provider: async (_url, init) => {
      const payload = JSON.parse(init.body);
      assert.doesNotMatch(payload.prompt, hashtag);
      assert.equal(payload.model, "gpt-image-2.5-flare-2026-09-08");
      assert.equal(payload.quality, "high");
      assert.equal(payload.size, "1024x1024");
      assert.equal(payload.n, 1);
      return fallback ? new Response("mock failure", { status: 503 }) : Response.json({ data: [{ b64_json: PNG }] });
    } });
    const result = await h.post(input);
    assert.equal(result.response.status, 200);
    assert.doesNotMatch(visibleText(decodeURIComponent(result.body.image)), hashtag);
    assert.deepEqual((await h.post(input)).body, result.body);
    assert.equal(h.calls.filter(call => call === "provider").length, 1);
    assert.equal(result.body.creditCharged, !fallback);
    assert.equal(h.data.usage_events_json?.length ?? 0, fallback ? 0 : 1);
    assert.deepEqual(input, original);
    for (const tag of tags.split(" ")) assert.ok(buildSectionCopyText(section).includes(tag));
  }
});
