import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const files = {
  registry: new URL("../lib/workflow-pages.ts", import.meta.url),
  indexPage: new URL("../app/workflows/page.tsx", import.meta.url),
  detailPage: new URL("../app/workflows/[slug]/page.tsx", import.meta.url),
  sitemap: new URL("../app/sitemap.ts", import.meta.url),
  publicPage: new URL("../components/public-page.tsx", import.meta.url),
  home: new URL("../app/page.tsx", import.meta.url),
};

async function read(name) {
  return readFile(files[name], "utf8");
}

function valuesFor(source, field) {
  return [...source.matchAll(new RegExp(`${field}:\\s*"([^"]+)"`, "g"))].map((match) => match[1]);
}

function recordFor(source, slug) {
  const start = source.indexOf(`slug: "${slug}"`);
  assert.notEqual(start, -1, `missing workflow record: ${slug}`);
  const end = source.indexOf("\n  },\n  {", start);
  return source.slice(start, end === -1 ? source.indexOf("\n  }\n];", start) : end);
}

test("ContentOS has ten approved workflow records and no generated rejected workflow pages", async () => {
  const registry = await read("registry");
  const slugs = valuesFor(registry, "slug");

  assert.equal(slugs.length, 10);
  assert.ok(slugs.includes("linkedin-post-generator-workflow"));
  assert.ok(slugs.includes("content-repurposing-workflow"));
  assert.ok(slugs.includes("consultant-content-workflow"));
  assert.doesNotMatch(registry, /slug: "onlyfans-content-workflow"/);
  assert.doesNotMatch(registry, /slug: "medical-content-workflow"/);
  assert.doesNotMatch(registry, /slug: "legal-advice-content-workflow"/);
  assert.doesNotMatch(registry, /slug: "viral-tiktok-growth-hack"/);
  assert.doesNotMatch(registry, /slug: "ai-blog-autopilot"/);
  assert.match(registry, /rejectedWorkflowSlugs/);
});

test("workflow SEO fields are unique and substantial", async () => {
  const registry = await read("registry");

  for (const field of ["slug", "title", "description", "h1", "keyword", "intent"]) {
    const values = valuesFor(registry, field);
    assert.equal(new Set(values).size, values.length, `${field} values should be unique`);
  }

  for (const description of valuesFor(registry, "description")) {
    assert.ok(description.length >= 100, `thin description: ${description}`);
  }

  assert.ok((registry.match(/useCases: \[/g) ?? []).length >= 10);
  assert.ok((registry.match(/steps: \[/g) ?? []).length >= 10);
  assert.ok((registry.match(/examples: \[/g) ?? []).length >= 10);
  assert.ok((registry.match(/responsibleUse:/g) ?? []).length >= 10);
});

test("the six priority workflows have distinct format guidance, examples, checks and visible FAQs", async () => {
  const registry = await read("registry");
  const prioritySlugs = [
    "instagram-caption-workflow",
    "tiktok-script-workflow",
    "x-thread-workflow",
    "newsletter-draft-workflow",
    "carousel-outline-workflow",
    "content-repurposing-workflow",
  ];

  for (const slug of prioritySlugs) {
    const record = recordFor(registry, slug);
    assert.match(record, /whenUseful:/, `${slug} needs workflow-specific timing guidance`);
    assert.match(record, /workedExample:/, `${slug} needs a worked example`);
    assert.match(record, /qualityChecks:/, `${slug} needs format-specific checks`);
    assert.match(record, /faqs:/, `${slug} needs visible FAQs`);
    assert.ok(valuesFor(record, "description")[0].length >= 120, `${slug} needs a substantial description`);
  }

  assert.equal((registry.match(/workedExample:/g) ?? []).length, 6);
  assert.equal((registry.match(/qualityChecks:/g) ?? []).length, 6);
  assert.equal((registry.match(/faqs:/g) ?? []).length, 6);
});

test("workflow renderer uses canonical metadata, structured data, breadcrumbs and related links", async () => {
  const indexPage = await read("indexPage");
  const detailPage = await read("detailPage");

  assert.match(indexPage, /pageMetadata/);
  assert.match(indexPage, /path: "\/workflows"/);
  assert.match(indexPage, /"@type": "CollectionPage"/);
  assert.match(indexPage, /"@type": "ItemList"/);
  assert.match(detailPage, /alternates:\s*\{\s*canonical/s);
  assert.match(detailPage, /robots:\s*\{\s*index: true,\s*follow: true/s);
  assert.match(detailPage, /"@type": "BreadcrumbList"/);
  assert.match(detailPage, /"@type": "WebPage"/);
  assert.match(detailPage, /"@type": "ItemList"/);
  assert.match(detailPage, /"@type": "FAQPage"/);
  assert.match(detailPage, /page\.faqs\?\.length/);
  assert.match(detailPage, /Related workflows/);
  assert.match(detailPage, /RelatedBlogLinks/);
  assert.match(detailPage, /notFound\(\)/);
});

test("workflow hub groups every page by intent and uses descriptive crawlable links", async () => {
  const registry = await read("registry");
  const indexPage = await read("indexPage");

  assert.match(indexPage, /Create for a specific channel/);
  assert.match(indexPage, /Build a reusable content system/);
  assert.match(indexPage, /Turn professional expertise into content/);
  assert.match(indexPage, /Use the \{page\.h1\}/);
  assert.doesNotMatch(indexPage, />\s*Open workflow\s*</);

  for (const slug of valuesFor(registry, "slug")) {
    assert.match(indexPage, new RegExp(`"${slug}"`), `${slug} should be prominent on the hub`);
  }
});

test("performing workflows provide contextual links into priority workflows", async () => {
  const registry = await read("registry");

  assert.match(recordFor(registry, "linkedin-post-generator-workflow"), /"x-thread-workflow"/);
  assert.match(recordFor(registry, "ai-brand-voice-workflow"), /"instagram-caption-workflow"/);
  assert.match(recordFor(registry, "founder-content-workflow"), /"tiktok-script-workflow"/);
  assert.match(recordFor(registry, "consultant-content-workflow"), /"carousel-outline-workflow"/);
});

test("workflow pages are discoverable in navigation and sitemap", async () => {
  const sitemap = await read("sitemap");
  const publicPage = await read("publicPage");
  const home = await read("home");

  assert.match(sitemap, /workflowPages/);
  assert.match(sitemap, /workflowPath\(page\.slug\)/);
  assert.match(sitemap, /path: "\/workflows"/);
  assert.match(publicPage, /href="\/workflows"/);
  assert.match(home, /href="\/workflows"/);
});

test("workflow copy avoids unsupported product and outcome claims", async () => {
  const source = [
    await read("registry"),
    await read("indexPage"),
    await read("detailPage"),
  ].join("\n");

  assert.doesNotMatch(source, /guarantee(s|d)? virality/i);
  assert.doesNotMatch(source, /medical advice/i);
  assert.doesNotMatch(source, /legal advice/i);
  assert.doesNotMatch(source, /fully automated publishing/i);
  assert.doesNotMatch(source, /replace(s)? human review/i);
  assert.match(source, /human review/i);
});
