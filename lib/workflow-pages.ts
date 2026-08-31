export type WorkflowPage = {
  slug: string;
  title: string;
  description: string;
  h1: string;
  keyword: string;
  audience: string;
  intent: string;
  intro: string;
  useCases: string[];
  steps: string[];
  examples: string[];
  variables: string[];
  responsibleUse: string;
  related: string[];
  blogLinks: string[];
};

export const workflowPages: WorkflowPage[] = [
  {
    slug: "linkedin-post-generator-workflow",
    title: "LinkedIn Post Generator Workflow | ContentOS",
    description:
      "A practical LinkedIn post generator workflow for turning one idea into authority-led posts, hooks, CTAs and review-ready drafts.",
    h1: "LinkedIn post generator workflow",
    keyword: "LinkedIn post generator workflow",
    audience: "Founders, consultants, coaches and professionals writing authority-led LinkedIn content.",
    intent: "Find a repeatable workflow for generating LinkedIn posts without losing expertise or voice.",
    intro:
      "LinkedIn rewards clear thinking more than sheer volume. This workflow helps you turn one idea, client question or founder update into a usable post draft with a sharp hook, structured argument and human review step before publishing.",
    useCases: [
      "Turn a client conversation into a practical thought-leadership post.",
      "Rewrite a rough founder note into a clear LinkedIn update.",
      "Create a short series of posts around one strategic theme."
    ],
    steps: [
      "Start with the audience problem and the specific point of view you want the post to carry.",
      "Generate three hook angles, then choose the one that best matches your real experience.",
      "Draft the post in short paragraphs with one clear lesson, example or decision.",
      "Add a low-pressure CTA that invites replies, saves or a next step.",
      "Review for accuracy, tone and any claims that need evidence before publishing."
    ],
    examples: [
      "Prompt: Turn this rough note into a LinkedIn post for [audience]. Keep the lesson practical, use my point of view, and end with a question that invites useful replies.",
      "Prompt: Give me five hook options for a LinkedIn post about [topic]. Avoid hype, keep the tone experienced and make each hook specific enough to be credible.",
      "Prompt: Rewrite this LinkedIn post draft so it sounds clearer and more authoritative without making claims I cannot support."
    ],
    variables: ["Audience", "Topic", "Point of view", "Example", "CTA", "Tone boundaries"],
    responsibleUse:
      "Treat generated posts as drafts. Check named people, client details, financial results and sensitive examples before anything goes live.",
    related: ["content-repurposing-workflow", "ai-brand-voice-workflow", "founder-content-workflow"],
    blogLinks: [
      "how-to-turn-one-founder-update-into-a-week-of-content",
      "how-to-create-an-ai-brand-voice-guide-that-keeps-content-consistent"
    ]
  },
  {
    slug: "instagram-caption-workflow",
    title: "Instagram Caption Workflow | ContentOS",
    description:
      "Create clearer Instagram captions from one idea with hooks, caption structure, CTA options and brand-voice checks.",
    h1: "Instagram caption workflow",
    keyword: "Instagram caption workflow",
    audience: "Creators, consultants and small teams turning ideas into readable Instagram captions.",
    intent: "Find a workflow for writing Instagram captions that support authority and action.",
    intro:
      "A good Instagram caption does more than fill space under a post. This workflow helps you connect the visual, the reader's problem and the next action, while keeping the caption concise enough for mobile reading.",
    useCases: [
      "Write captions for carousel posts, reels and behind-the-scenes updates.",
      "Turn a tip or lesson into a caption with a stronger opening line.",
      "Create caption variants for educational, reflective and promotional posts."
    ],
    steps: [
      "Summarise the visual asset and the audience problem it supports.",
      "Draft a first line that makes the viewer want to expand the caption.",
      "Use two or three short sections: context, useful point and next step.",
      "Generate CTA options for comments, saves, link clicks or product interest.",
      "Edit for platform fit, brand voice and unsupported claims."
    ],
    examples: [
      "Prompt: Write an Instagram caption for this carousel topic: [topic]. Use a useful first line, short paragraphs and one CTA for [desired action].",
      "Prompt: Give me three caption versions for [audience]: practical, personal and product-aware. Keep each under [word count].",
      "Prompt: Tighten this caption for mobile readability while preserving my point of view and CTA."
    ],
    variables: ["Visual format", "Audience", "Caption topic", "CTA goal", "Word count", "Brand tone"],
    responsibleUse:
      "Review captions for factual accuracy, image alignment and any client or personal details that should not be shared publicly.",
    related: ["carousel-outline-workflow", "content-repurposing-workflow", "ai-brand-voice-workflow"],
    blogLinks: [
      "a-simple-content-repurposing-workflow-for-turning-one-idea-into-a-week-of-posts",
      "content-workflow-quality-review-system"
    ]
  },
  {
    slug: "tiktok-script-workflow",
    title: "TikTok Script Workflow | ContentOS",
    description:
      "Plan short-form TikTok scripts from one idea with hooks, scene beats, spoken lines and human review guidance.",
    h1: "TikTok script workflow",
    keyword: "TikTok script workflow",
    audience: "Creators and founder-led brands making short-form educational or opinion-led videos.",
    intent: "Find a repeatable process for turning ideas into short-form video scripts.",
    intro:
      "Short-form scripts need a faster rhythm than written posts. This workflow turns a rough idea into a hook, three or four speaking beats, visual notes and a clear ending, without pretending that AI can predict reach.",
    useCases: [
      "Draft a 30 to 60 second educational video script.",
      "Turn a founder opinion into a concise talking-head video.",
      "Create alternate hooks for testing without changing the core message."
    ],
    steps: [
      "Define the viewer, the problem and the one point the video must land.",
      "Generate hooks that create curiosity without false urgency.",
      "Map the script into short spoken beats with optional on-screen text.",
      "Add simple visual cues that support the message rather than distract from it.",
      "Read the script aloud, shorten anything unnatural and fact-check claims."
    ],
    examples: [
      "Prompt: Turn this idea into a 45-second TikTok script for [audience]. Include hook, spoken beats, on-screen text and a natural closing line.",
      "Prompt: Give me five non-clickbait hooks for a short video about [topic]. Keep them specific and credible.",
      "Prompt: Rewrite this script so it sounds conversational when spoken aloud, not like an essay."
    ],
    variables: ["Viewer", "Topic", "Video length", "Tone", "Visual notes", "CTA"],
    responsibleUse:
      "Do not publish scripts with medical, legal, financial or performance claims without expert review and supporting evidence.",
    related: ["content-repurposing-workflow", "founder-content-workflow", "instagram-caption-workflow"],
    blogLinks: [
      "the-content-workflow-every-creator-needs-in-2026",
      "content-workflow-quality-review-system"
    ]
  },
  {
    slug: "x-thread-workflow",
    title: "X Thread Workflow | ContentOS",
    description:
      "Structure X threads from one idea with a clear hook, logical sequence, useful examples and review-ready posts.",
    h1: "X thread workflow",
    keyword: "X thread workflow",
    audience: "Professionals and creators turning one idea into concise, connected social posts.",
    intent: "Find a process for drafting useful X threads from one topic.",
    intro:
      "A thread works when each post earns the next one. This workflow helps you outline the promise, sequence the idea, add useful examples and avoid padding a topic into a thread that should have been a single post.",
    useCases: [
      "Break down a framework into a short thread.",
      "Turn a blog or newsletter idea into a social sequence.",
      "Create concise thread drafts with a strong opening and useful close."
    ],
    steps: [
      "Write the one-sentence promise the thread should deliver.",
      "List the logical points before drafting individual posts.",
      "Keep each post focused on one idea, example or action.",
      "Add a closing post that summarises the value and gives a relevant next step.",
      "Remove repetition and fact-check any named tools, trends or results."
    ],
    examples: [
      "Prompt: Turn this idea into a seven-post X thread. Make each post useful on its own and avoid repeating the same phrase.",
      "Prompt: Create three opening-post options for a thread about [topic]. Make the promise concrete and avoid exaggerated results.",
      "Prompt: Review this thread for repetition, weak transitions and unsupported claims."
    ],
    variables: ["Thread promise", "Audience", "Number of posts", "Examples", "CTA", "Claims to avoid"],
    responsibleUse:
      "Review threads for context collapse: short posts can be misread, so remove sensitive details and clarify caveats where needed.",
    related: ["linkedin-post-generator-workflow", "newsletter-draft-workflow", "content-repurposing-workflow"],
    blogLinks: [
      "a-simple-content-repurposing-workflow-for-turning-one-idea-into-a-week-of-posts",
      "content-repurposing-quality-control-checklist"
    ]
  },
  {
    slug: "newsletter-draft-workflow",
    title: "Newsletter Draft Workflow | ContentOS",
    description:
      "A newsletter draft workflow for turning one idea into a useful email with structure, subject lines, examples and CTA options.",
    h1: "Newsletter draft workflow",
    keyword: "newsletter draft workflow",
    audience: "Founders, consultants and creators writing practical newsletter issues.",
    intent: "Find a repeatable workflow for drafting newsletters from rough ideas.",
    intro:
      "Newsletters need enough depth to be worth opening, but not so much structure that they become heavy to write. This workflow turns a rough idea into a readable issue with a subject line, opening, useful middle and next action.",
    useCases: [
      "Draft a weekly newsletter from a founder update.",
      "Turn a client lesson into an educational email.",
      "Repurpose a social post into a deeper inbox-friendly piece."
    ],
    steps: [
      "Choose the reader problem and the one useful takeaway.",
      "Generate subject line options with different angles: direct, curiosity-led and practical.",
      "Draft an opening that explains why the topic matters now.",
      "Use examples, questions or steps to make the middle useful.",
      "End with one CTA, then review the email for clarity and evidence."
    ],
    examples: [
      "Prompt: Turn this rough idea into a newsletter draft for [audience]. Include subject lines, preview text, a clear lesson and one CTA.",
      "Prompt: Make this email more practical by adding examples, but do not invent results or client stories.",
      "Prompt: Shorten this newsletter while keeping the main lesson and the call to action."
    ],
    variables: ["Reader", "Topic", "Main takeaway", "CTA", "Evidence", "Tone"],
    responsibleUse:
      "Check every story, statistic and recommendation before sending. Email feels personal, so be especially careful with trust and permissions.",
    related: ["content-repurposing-workflow", "founder-content-workflow", "linkedin-post-generator-workflow"],
    blogLinks: [
      "why-most-content-creators-quit",
      "why-most-business-owners-quit-content-marketing-too-soon"
    ]
  },
  {
    slug: "carousel-outline-workflow",
    title: "Carousel Outline Workflow | ContentOS",
    description:
      "Plan carousel outlines for LinkedIn or Instagram with slide-by-slide logic, hooks, takeaways and review guidance.",
    h1: "Carousel outline workflow",
    keyword: "carousel outline workflow",
    audience: "Creators and small teams planning educational carousel content.",
    intent: "Find a workflow for outlining carousel posts before design.",
    intro:
      "A carousel should feel like a guided argument, not a chopped-up blog post. This workflow helps you define the promise, plan each slide and make the design brief easier to execute.",
    useCases: [
      "Turn a framework into a 6 to 10 slide carousel.",
      "Create a slide outline before opening a design tool.",
      "Repurpose a blog section or newsletter into a visual educational post."
    ],
    steps: [
      "Write the cover-slide promise and the specific reader outcome.",
      "Map the slide sequence: problem, insight, steps, example and takeaway.",
      "Draft one idea per slide with concise supporting text.",
      "Add a final slide with a save-worthy recap or low-pressure CTA.",
      "Review for visual overload before the design stage."
    ],
    examples: [
      "Prompt: Create a nine-slide carousel outline from this topic: [topic]. Give each slide a heading and one concise supporting point.",
      "Prompt: Convert this blog section into a carousel outline for [platform]. Keep the logic sequential and remove repetition.",
      "Prompt: Review this carousel outline for weak slide flow, too much text and missing takeaway."
    ],
    variables: ["Platform", "Slide count", "Reader outcome", "Topic", "CTA", "Design constraints"],
    responsibleUse:
      "Review carousel outlines before design so unsupported claims, copied frameworks or unclear examples are removed early.",
    related: ["instagram-caption-workflow", "content-repurposing-workflow", "linkedin-post-generator-workflow"],
    blogLinks: [
      "how-to-build-a-content-calendar-system-that-actually-gets-used",
      "a-simple-content-repurposing-workflow-for-turning-one-idea-into-a-week-of-posts"
    ]
  },
  {
    slug: "content-repurposing-workflow",
    title: "Content Repurposing Workflow | ContentOS",
    description:
      "Turn one strong idea into platform-ready content assets with a repeatable content repurposing workflow.",
    h1: "Content repurposing workflow",
    keyword: "content repurposing workflow",
    audience: "Creators, founders, consultants and small teams who need more output from fewer strong ideas.",
    intent: "Find a workflow for repurposing one idea across multiple channels.",
    intro:
      "Repurposing is not copying the same paragraph everywhere. It is the process of preserving the idea while reshaping the structure, length, hook and CTA for each platform. This workflow helps you build a weekly content pack from one source idea.",
    useCases: [
      "Turn one founder update into LinkedIn, email and short-form assets.",
      "Create a weekly content pack from one insight or client question.",
      "Keep content consistent across platforms without repeating the same copy."
    ],
    steps: [
      "Define the source idea and the audience outcome it supports.",
      "Choose the channel mix before drafting: LinkedIn, email, short video, carousel or X thread.",
      "Create each asset around the platform's behaviour and reading context.",
      "Cross-check the pack for message consistency and duplicated phrasing.",
      "Save learnings so the next content cycle starts faster."
    ],
    examples: [
      "Prompt: Turn this source idea into a weekly content pack with LinkedIn, newsletter, X thread, carousel and TikTok script options.",
      "Prompt: Repurpose this newsletter into three platform-specific posts. Keep the main idea, but change the structure for each platform.",
      "Prompt: Audit this content pack for repetition, weak CTAs and inconsistent brand voice."
    ],
    variables: ["Source idea", "Audience", "Channels", "Core lesson", "CTA", "Publishing cadence"],
    responsibleUse:
      "Make sure each asset fits the platform and does not overstate expertise, results or product benefits.",
    related: ["linkedin-post-generator-workflow", "newsletter-draft-workflow", "carousel-outline-workflow"],
    blogLinks: [
      "a-simple-content-repurposing-workflow-for-turning-one-idea-into-a-week-of-posts",
      "content-repurposing-quality-control-checklist"
    ]
  },
  {
    slug: "ai-brand-voice-workflow",
    title: "AI Brand Voice Workflow | ContentOS",
    description:
      "Build a practical AI brand voice workflow that keeps generated content consistent, credible and reviewable.",
    h1: "AI brand voice workflow",
    keyword: "AI brand voice workflow",
    audience: "Founders, consultants and creators who want AI-assisted content to sound consistent.",
    intent: "Find a workflow for using AI without losing brand voice.",
    intro:
      "Brand voice is not a list of adjectives. It is a working reference for what your content should sound like, what it should avoid and how drafts should be reviewed. This workflow helps turn real examples into usable AI instructions.",
    useCases: [
      "Create a reusable voice brief for AI-generated content.",
      "Review drafts against voice, audience and claim boundaries.",
      "Keep founder-led content from becoming generic as output increases."
    ],
    steps: [
      "Collect strong examples of your existing writing, talks or client explanations.",
      "Extract patterns: tone, vocabulary, sentence shape, opinions and boundaries.",
      "Write prompt instructions that describe what to do and what to avoid.",
      "Test the voice against several content formats and revise the brief.",
      "Use human review for nuance, expertise and sensitive claims."
    ],
    examples: [
      "Prompt: Analyse these writing samples and summarise my brand voice in practical instructions for future drafts.",
      "Prompt: Rewrite this draft using my voice guide. Preserve the factual points and remove generic AI phrasing.",
      "Prompt: Review this content for places where it no longer sounds like [brand/person]."
    ],
    variables: ["Writing samples", "Audience", "Voice traits", "Avoid list", "Examples", "Review criteria"],
    responsibleUse:
      "Never treat a voice workflow as a substitute for judgement. Review all sensitive, expert or product-related claims before publishing.",
    related: ["founder-content-workflow", "linkedin-post-generator-workflow", "content-repurposing-workflow"],
    blogLinks: [
      "how-to-create-an-ai-brand-voice-guide-that-keeps-content-consistent",
      "content-workflow-quality-review-system"
    ]
  },
  {
    slug: "founder-content-workflow",
    title: "Founder Content Workflow | ContentOS",
    description:
      "A founder content workflow for turning updates, decisions and lessons into useful platform-ready content.",
    h1: "Founder content workflow",
    keyword: "founder content workflow",
    audience: "Founders and operators who want to publish useful content from real business work.",
    intent: "Find a practical process for creating founder-led content consistently.",
    intro:
      "Founder content works best when it is grounded in real decisions, lessons and customer conversations. This workflow helps turn raw updates into useful posts without exposing private information or forcing every note into a polished announcement.",
    useCases: [
      "Turn a product update into a LinkedIn post or newsletter.",
      "Capture lessons from customer calls without sharing private details.",
      "Build a repeatable weekly founder-content habit."
    ],
    steps: [
      "Capture the raw update: what changed, why it mattered and who it helps.",
      "Choose the content angle: lesson, decision, behind-the-scenes or customer question.",
      "Draft the asset in the founder's voice with clear context and boundaries.",
      "Repurpose the idea into one or two supporting formats.",
      "Review for confidentiality, accuracy and unnecessary bravado."
    ],
    examples: [
      "Prompt: Turn this founder update into a LinkedIn post that explains the decision, the trade-off and the lesson for [audience].",
      "Prompt: Create a newsletter draft from this week's product notes. Keep it honest, practical and useful.",
      "Prompt: Remove private details from this founder story while preserving the lesson."
    ],
    variables: ["Update", "Audience", "Lesson", "Confidential details", "CTA", "Voice"],
    responsibleUse:
      "Strip out private customer details, confidential revenue information and unsupported growth claims before publishing founder content.",
    related: ["newsletter-draft-workflow", "linkedin-post-generator-workflow", "ai-brand-voice-workflow"],
    blogLinks: [
      "how-to-turn-one-founder-update-into-a-week-of-content",
      "why-most-business-owners-quit-content-marketing-too-soon"
    ]
  },
  {
    slug: "consultant-content-workflow",
    title: "Consultant Content Workflow | ContentOS",
    description:
      "A consultant content workflow for turning expertise, client questions and frameworks into credible platform-ready content.",
    h1: "Consultant content workflow",
    keyword: "consultant content workflow",
    audience: "Consultants, coaches and service professionals publishing expertise-led content.",
    intent: "Find a workflow for turning consulting expertise into useful content.",
    intro:
      "Consultant content should make expertise visible without giving away private client context or slipping into vague advice. This workflow turns questions, frameworks and observations into useful posts, emails and outlines.",
    useCases: [
      "Turn a client question into an educational post.",
      "Create a newsletter from a repeatable consulting framework.",
      "Repurpose one workshop lesson into several platform-specific assets."
    ],
    steps: [
      "Choose one client-safe problem or question.",
      "State the useful distinction, framework or decision rule.",
      "Add a practical example without identifying private client details.",
      "Generate platform-specific drafts with a clear next step.",
      "Review for confidentiality, professional boundaries and unsupported claims."
    ],
    examples: [
      "Prompt: Turn this client question into a consultant-style LinkedIn post for [audience]. Keep it practical and remove confidential details.",
      "Prompt: Create a newsletter outline from this framework. Include examples but do not invent client results.",
      "Prompt: Repurpose this workshop note into a LinkedIn post, X thread and email draft."
    ],
    variables: ["Client-safe problem", "Framework", "Audience", "Example", "CTA", "Professional boundaries"],
    responsibleUse:
      "Do not publish client-sensitive information or advice that should be tailored by a qualified professional.",
    related: ["linkedin-post-generator-workflow", "newsletter-draft-workflow", "ai-brand-voice-workflow"],
    blogLinks: [
      "how-to-create-a-content-brief-template-that-keeps-ai-output-consistent",
      "content-workflow-quality-review-system"
    ]
  }
];

export const rejectedWorkflowSlugs = [
  "onlyfans-content-workflow",
  "medical-content-workflow",
  "legal-advice-content-workflow",
  "viral-tiktok-growth-hack",
  "ai-blog-autopilot"
];

export function getWorkflowPage(slug: string) {
  return workflowPages.find((page) => page.slug === slug);
}

export function workflowPath(slug: string) {
  return `/workflows/${slug}`;
}
