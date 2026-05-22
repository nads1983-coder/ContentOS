"use client";

import {
  ArrowLeft,
  Archive,
  Bookmark,
  BookmarkCheck,
  Bold,
  Check,
  ChevronRight,
  Clipboard,
  Copy,
  Eraser,
  FileText,
  History,
  Italic,
  List,
  ListOrdered,
  Loader2,
  Lock,
  Menu,
  Monitor,
  PenLine,
  RefreshCcw,
  Save,
  Smartphone,
  Sparkles,
  Strikethrough,
  Trash2,
  Type,
  Underline,
  Wand2,
  X
} from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { clsx } from "clsx";
import { BrandLogo } from "@/components/brand-logo";
import {
  ctaModes,
  contentTypes,
  defaultSelectedTypes,
  filters,
  labelForCtaMode,
  labelForSharpness,
  labelForContentType,
  labelForPresetTopic,
  labelForTone,
  presetTopics,
  sharpnessModes,
  tones
} from "@/lib/content-config";
import {
  addRecent,
  readStore,
  toggleSaved,
  removeSaved,
  upsertDraft,
  writeStore
} from "@/lib/storage";
import {
  ContentTypeId,
  CtaModeId,
  Draft,
  FilterId,
  GenerateRequest,
  GeneratedSection,
  GenerationResult,
  PresetTopicId,
  SharpnessId,
  StudioStore,
  ToneId
} from "@/types/content";

const starterText =
  "We just launched a lightweight planning service for busy founders who need consistent content but do not have time to turn every idea into platform-ready posts.";

const sampleCreatedAt = "2026-01-01T09:00:00.000Z";

const sampleResult: GenerationResult = {
  id: "sample",
  createdAt: sampleCreatedAt,
  source: starterText,
  tone: "professional",
  sharpness: "balanced",
  ctaMode: "soft",
  presetTopic: "business",
  selectedTypes: defaultSelectedTypes,
  title: "Founder Content Planning",
  summary:
    "A practical content angle for turning a new service into platform-ready posts.",
  sections: [
    {
      id: "sample-linkedin",
      type: "linkedin",
      title: "LinkedIn Post",
      platform: "LinkedIn",
      body:
        "Consistent content does not usually fail because founders have no ideas.\n\nIt fails because the ideas stay scattered across notes, calls, voice memos, and half-written drafts.\n\nThat is the gap our new planning service is built for.\n\nWe take the raw thinking you already have and turn it into a usable content system, posts, captions, scripts, and repurposing paths that match the way your business actually sells.\n\nThe goal is not more noise.\n\nIt is a cleaner way to show up with useful ideas, clear offers, and enough structure to stay consistent.",
      items: ["Strong hook", "Short paragraphs", "Practical service positioning"],
      cta: "What part of your content workflow slows you down the most?"
    },
    {
      id: "sample-instagram",
      type: "instagram",
      title: "Instagram Caption",
      platform: "Instagram",
      body:
        "Your best content ideas are probably already sitting somewhere.\n\nIn a voice note.\nIn a client call.\nIn a messy draft.\nIn the thing you explain every week.\n\nThe hard part is turning those ideas into posts you can actually use across platforms.\n\nThat is what our new planning service is designed to make easier.",
      items: [
        "#contentstrategy",
        "#smallbusinessmarketing",
        "#personalbrand",
        "#creatorworkflow",
        "#socialmediatips"
      ],
      cta: "Save this if content planning keeps falling to the bottom of the list."
    },
    {
      id: "sample-hashtags",
      type: "platformHashtags",
      title: "Platform Hashtags",
      platform: "General",
      body: "Platform-specific hashtag sets for this content angle.",
      items: [
        "LinkedIn: #contentstrategy #smallbusinessmarketing #foundermarketing #personalbrand",
        "Instagram: #contentstrategy #socialmediatips #creatorworkflow #smallbusinessowner #contentplanning",
        "TikTok: #contenttips #smallbusinesstips #creatorworkflow #marketingtips",
        "X/Twitter: #contentstrategy",
        "YouTube Shorts: content strategy, social media planning, founder marketing, repurposing content, creator workflow"
      ],
      cta: ""
    },
    {
      id: "sample-hooks",
      type: "hooks",
      title: "Hooks",
      platform: "General",
      body: "Sharp openings for the same business angle.",
      items: [
        "Your content problem might not be a lack of ideas.",
        "Most founders do not need more blank documents.",
        "The best content system starts with the thinking you already have.",
        "Repurposing works better when the idea is structured first."
      ],
      cta: ""
    }
  ]
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(new Date(value));
}

function isSaved(store: StudioStore, result?: GenerationResult) {
  if (!result) {
    return false;
  }

  return store.saved.some((item) => item.id === result.id);
}

function sectionMatchesFilter(section: GeneratedSection, activeFilter: FilterId) {
  if (activeFilter === "all" || activeFilter === "saved") {
    return true;
  }

  if (activeFilter === "hashtags") {
    return section.type === "platformHashtags";
  }

  if (activeFilter === "youtube") {
    return section.type === "youtubeShorts";
  }

  if (activeFilter === "video") {
    return section.type === "shortVideoScript";
  }

  if (activeFilter === "email") {
    return section.type === "emailNewsletter";
  }

  if (activeFilter === "repurpose") {
    return section.type === "repurposePack";
  }

  return contentTypes.find((type) => type.id === section.type)?.group === activeFilter;
}

function isPaidContentType(id: ContentTypeId) {
  return Boolean(contentTypes.find((type) => type.id === id)?.paidOnly);
}

function buildGenerationText(result: GenerationResult) {
  return result.sections
    .map((section) =>
      [
        section.title,
        section.body,
        ...section.items.map((item) => `- ${item}`),
        section.cta ? `CTA: ${section.cta}` : ""
      ]
        .filter(Boolean)
        .join("\n\n")
    )
    .join("\n\n---\n\n");
}

function refineText(text: string, action: string) {
  const trimmed = text.trim();

  if (action === "shorten") {
    return trimmed
      .split(/\n+/)
      .map((line) => line.split(" ").slice(0, 22).join(" "))
      .join("\n");
  }

  if (action === "improve hook") {
    const firstLine = trimmed.split("\n")[0] ?? "";
    return `Hook option:\nWhat if ${firstLine.charAt(0).toLowerCase()}${firstLine.slice(1)}?\n\n${trimmed}`;
  }

  if (action === "improve CTA") {
    return `${trimmed}\n\nCTA options:\n- Save this for your next content planning session.\n- Want the full workflow? Start with one idea and build the pack.\n- Which platform would you turn this into first?`;
  }

  return `${action} version:\n\n${trimmed}`;
}

async function copyText(text: string) {
  await navigator.clipboard.writeText(text);
}

type FormatterMode = "desktop" | "mobile";
type PlanId = "free" | "pro";
type FormatterPlatform = "linkedin" | "instagram" | "tiktok" | "xThread" | "shortVideoScript";
type TextStyle = "bold" | "italic" | "boldItalic" | "underline" | "strikethrough";

const FREE_GENERATION_LIMIT = 3;

const formatterPlatforms: Array<{
  id: FormatterPlatform;
  label: string;
  title: string;
  helper: string;
}> = [
  {
    id: "linkedin",
    label: "LinkedIn",
    title: "LinkedIn Post",
    helper: "Clean paragraphs, strong opening, and professional spacing."
  },
  {
    id: "instagram",
    label: "Instagram",
    title: "Instagram Caption",
    helper: "Mobile-friendly spacing, caption rhythm, and hashtag room."
  },
  {
    id: "tiktok",
    label: "TikTok",
    title: "TikTok Caption",
    helper: "Short hook-led captions with minimal filler."
  },
  {
    id: "xThread",
    label: "X Thread",
    title: "X Thread",
    helper: "Numbered posts with a tight idea flow."
  },
  {
    id: "shortVideoScript",
    label: "Video Script",
    title: "Short-form Video Script",
    helper: "Hook, beats, on-screen text, and closing line."
  }
];

const formatterStarterText =
  "Your best content ideas are probably already sitting in your notes, calls, and drafts.\n\nA strong workflow turns those raw ideas into posts, captions, scripts, and emails without starting from a blank page every time.";

const plainAlphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
const boldAlphabet =
  "𝐀𝐁𝐂𝐃𝐄𝐅𝐆𝐇𝐈𝐉𝐊𝐋𝐌𝐍𝐎𝐏𝐐𝐑𝐒𝐓𝐔𝐕𝐖𝐗𝐘𝐙𝐚𝐛𝐜𝐝𝐞𝐟𝐠𝐡𝐢𝐣𝐤𝐥𝐦𝐧𝐨𝐩𝐪𝐫𝐬𝐭𝐮𝐯𝐰𝐱𝐲𝐳";
const italicAlphabet =
  "𝐴𝐵𝐶𝐷𝐸𝐹𝐺𝐻𝐼𝐽𝐾𝐿𝑀𝑁𝑂𝑃𝑄𝑅𝑆𝑇𝑈𝑉𝑊𝑋𝑌𝑍𝑎𝑏𝑐𝑑𝑒𝑓𝑔ℎ𝑖𝑗𝑘𝑙𝑚𝑛𝑜𝑝𝑞𝑟𝑠𝑡𝑢𝑣𝑤𝑥𝑦𝑧";
const boldItalicAlphabet =
  "𝑨𝑩𝑪𝑫𝑬𝑭𝑮𝑯𝑰𝑱𝑲𝑳𝑴𝑵𝑶𝑷𝑸𝑹𝑺𝑻𝑼𝑽𝑾𝑿𝒀𝒁𝒂𝒃𝒄𝒅𝒆𝒇𝒈𝒉𝒊𝒋𝒌𝒍𝒎𝒏𝒐𝒑𝒒𝒓𝒔𝒕𝒖𝒗𝒘𝒙𝒚𝒛";
const plainDigits = "0123456789";
const boldDigits = "𝟎𝟏𝟐𝟑𝟒𝟓𝟔𝟕𝟖𝟗";

function mapCharacters(text: string, alphabet: string, digitSet = plainDigits) {
  return Array.from(text)
    .map((character) => {
      const letterIndex = plainAlphabet.indexOf(character);
      if (letterIndex >= 0) {
        return Array.from(alphabet)[letterIndex] ?? character;
      }

      const digitIndex = plainDigits.indexOf(character);
      if (digitIndex >= 0) {
        return Array.from(digitSet)[digitIndex] ?? character;
      }

      return character;
    })
    .join("");
}

function addCombiningMark(text: string, mark: string) {
  return Array.from(text)
    .map((character) => (/\s/.test(character) ? character : `${character}${mark}`))
    .join("");
}

function styleText(text: string, style: TextStyle) {
  if (style === "bold") {
    return mapCharacters(text, boldAlphabet, boldDigits);
  }

  if (style === "italic") {
    return mapCharacters(text, italicAlphabet);
  }

  if (style === "boldItalic") {
    return mapCharacters(text, boldItalicAlphabet, boldDigits);
  }

  if (style === "underline") {
    return addCombiningMark(text, "\u0332");
  }

  return addCombiningMark(text, "\u0336");
}

function prefixSelectedLines(text: string, numbered: boolean) {
  const lines = text.split("\n");
  let count = 1;

  return lines
    .map((line) => {
      if (!line.trim()) {
        return line;
      }

      const prefix = numbered ? `${count}. ` : "• ";
      count += 1;
      return `${prefix}${line.replace(/^([•]|\d+\.)\s+/, "")}`;
    })
    .join("\n");
}

export function StudioShell({ embedded = false }: { embedded?: boolean }) {
  const [source, setSource] = useState(starterText);
  const [brandName, setBrandName] = useState("");
  const [audience, setAudience] = useState("");
  const [offer, setOffer] = useState("");
  const [brandVoice, setBrandVoice] = useState("");
  const [contentGoal, setContentGoal] = useState("");
  const [tone, setTone] = useState<ToneId>("professional");
  const [sharpness, setSharpness] = useState<SharpnessId>("balanced");
  const [ctaMode, setCtaMode] = useState<CtaModeId>("soft");
  const [presetTopic, setPresetTopic] = useState<PresetTopicId>("business");
  const [selectedTypes, setSelectedTypes] = useState<ContentTypeId[]>(defaultSelectedTypes);
  const [activeFilter, setActiveFilter] = useState<FilterId>("all");
  const [plan, setPlan] = useState<PlanId>("free");
  const [store, setStore] = useState<StudioStore>({
    version: 1,
    recent: [],
    saved: [],
    drafts: []
  });
  const [hasMounted, setHasMounted] = useState(false);
  const [result, setResult] = useState<GenerationResult>(sampleResult);
  const [error, setError] = useState("");
  const [copiedId, setCopiedId] = useState("");
  const [historyOpen, setHistoryOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [isPending, setIsPending] = useState(false);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setStore(readStore());
      setHasMounted(true);
    }, 0);

    return () => window.clearTimeout(timeout);
  }, []);

  useEffect(() => {
    if (!hasMounted) {
      return;
    }

    writeStore(store);
  }, [hasMounted, store]);

  const visibleSections = useMemo(() => {
    const sourceResult =
      activeFilter === "saved" && store.saved.length ? store.saved[0] : result;

    return sourceResult.sections.filter((section) =>
      sectionMatchesFilter(section, activeFilter)
    );
  }, [activeFilter, result, store.saved]);

  const usedGenerations = store.recent.length;
  const freeRemaining = Math.max(0, FREE_GENERATION_LIMIT - usedGenerations);
  const hasPaidSelection = selectedTypes.some(isPaidContentType);
  const isPro = plan === "pro";
  const canGenerate =
    source.trim().length > 7 &&
    selectedTypes.length > 0 &&
    !isPending &&
    (isPro || (!hasPaidSelection && freeRemaining > 0));

  function persistStore(nextStore: StudioStore) {
    setStore(nextStore);
    writeStore(nextStore);
  }

  async function generateContent(nextSource = source) {
    setError("");

    if (!isPro && hasPaidSelection) {
      setError("Upgrade to Pro to unlock repurposing, formatter presets, CTAs, carousels, video scripts, email drafts, and saved history.");
      return;
    }

    if (!isPro && freeRemaining <= 0) {
      setError("You have used the free generation limit. Upgrade to Pro to keep generating.");
      return;
    }

    setIsPending(true);

    const payload: GenerateRequest = {
      source: nextSource,
      brandName,
      audience,
      offer,
      brandVoice,
      contentGoal,
      tone,
      sharpness,
      ctaMode,
      presetTopic,
      selectedTypes
    };

    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });

      const data = (await response.json()) as GenerationResult | { error?: string };

      if (!response.ok) {
        const message = "error" in data ? data.error : undefined;
        throw new Error(message ?? "Generation failed.");
      }

      if (!("sections" in data)) {
        throw new Error("Generation returned an unexpected response.");
      }

      setResult(data);
      persistStore(addRecent(readStore(), data));
    } catch (generationError) {
      setError(
        generationError instanceof Error
          ? generationError.message
          : "Generation failed. Try again."
      );
    } finally {
      setIsPending(false);
    }
  }

  function toggleType(id: ContentTypeId) {
    setSelectedTypes((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id]
    );
  }

  function saveDraft() {
    const draft: Draft = {
      id: crypto.randomUUID(),
      updatedAt: new Date().toISOString(),
      title: source.trim().slice(0, 54) || "Untitled content note",
      source,
      tone,
      sharpness,
      ctaMode,
      presetTopic,
      selectedTypes
    };

    persistStore(upsertDraft(readStore(), draft));
  }

  function loadDraft(draft: Draft) {
    setSource(draft.source);
    setTone(draft.tone);
    setSharpness(draft.sharpness ?? "balanced");
    setCtaMode(draft.ctaMode ?? "soft");
    setPresetTopic(draft.presetTopic ?? "none");
    setSelectedTypes(draft.selectedTypes);
    setHistoryOpen(false);
  }

  function saveCurrent() {
    if (!isPro) {
      setError("Saved history is a Pro feature in this placeholder paywall.");
      return;
    }

    persistStore(toggleSaved(readStore(), result));
  }

  function deleteSaved(id: string) {
    persistStore(removeSaved(readStore(), id));
  }

  function scrollToStudioSection(target: "composer" | "outputs" | "formatter") {
    document.getElementById(target)?.scrollIntoView({
      behavior: "smooth",
      block: "start"
    });
  }

  function handleRailAction(action: RailAction) {
    if (action === "studio") {
      scrollToStudioSection("composer");
      return;
    }

    if (action === "outputs") {
      setActiveFilter("all");
      scrollToStudioSection("outputs");
      return;
    }

    if (action === "formatter") {
      scrollToStudioSection("formatter");
      return;
    }

    if (action === "saved") {
      setActiveFilter("saved");
      scrollToStudioSection("outputs");
      return;
    }

    setHistoryOpen(true);
    window.setTimeout(() => {
      document.getElementById("history-drafts")?.scrollIntoView({
        behavior: "smooth",
        block: "start"
      });
    }, 80);
  }

  async function copySection(section: GeneratedSection) {
    const text = [
      section.title,
      section.body,
      ...section.items.map((item) => `- ${item}`),
      section.cta ? `CTA: ${section.cta}` : ""
    ]
      .filter(Boolean)
      .join("\n\n");

    await copyText(text);
    setCopiedId(section.id);
    window.setTimeout(() => setCopiedId(""), 1400);
  }

  return (
    <main className="min-h-screen pb-28 text-bone lg:pb-0">
      <div className="pointer-events-none fixed inset-0 opacity-80">
        <div className="absolute right-[-5rem] top-12 h-72 w-72 rounded-full bg-violet/20 blur-3xl" />
        <div className="absolute bottom-28 left-[-6rem] h-64 w-64 rounded-full bg-gold/10 blur-3xl" />
      </div>

      <TopBar
        menuOpen={menuOpen}
        plan={plan}
        onToggleMenu={() => setMenuOpen((value) => !value)}
        onOpenHistory={() => setHistoryOpen(true)}
      />

      <div className="relative mx-auto grid w-full max-w-7xl gap-4 px-4 pb-6 pt-4 sm:px-5 lg:grid-cols-[5rem_minmax(0,1fr)_22rem] lg:gap-5 lg:px-6 lg:pt-6">
        <DesktopRail onNavigate={handleRailAction} />

        <div className="min-w-0 space-y-4">
          <section className="grid min-w-0 gap-4 2xl:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)]">
            <ComposerPanel
              id="composer"
              source={source}
              tone={tone}
              sharpness={sharpness}
              ctaMode={ctaMode}
              presetTopic={presetTopic}
              selectedTypes={selectedTypes}
              brandName={brandName}
              audience={audience}
              offer={offer}
              brandVoice={brandVoice}
              contentGoal={contentGoal}
              plan={plan}
              freeRemaining={freeRemaining}
              canGenerate={canGenerate}
              isPending={isPending}
              onSourceChange={setSource}
              onBrandNameChange={setBrandName}
              onAudienceChange={setAudience}
              onOfferChange={setOffer}
              onBrandVoiceChange={setBrandVoice}
              onContentGoalChange={setContentGoal}
              onToneChange={setTone}
              onSharpnessChange={setSharpness}
              onCtaModeChange={setCtaMode}
              onPresetTopicChange={setPresetTopic}
              onToggleType={toggleType}
              onGenerate={() => generateContent()}
              onSaveDraft={saveDraft}
              onPlanChange={setPlan}
            />

            <OutputPanel
              id="outputs"
              result={result}
              activeFilter={activeFilter}
              visibleSections={visibleSections}
              error={error}
              copiedId={copiedId}
              isPending={isPending}
              onFilterChange={setActiveFilter}
              onCopySection={copySection}
              onRegenerate={() => generateContent()}
              onSaveCurrent={saveCurrent}
              onCopyRefinement={async (section, action) => {
                await copyText(refineText([section.body, section.cta].filter(Boolean).join("\n\n"), action));
                setCopiedId(`${section.id}-${action}`);
                window.setTimeout(() => setCopiedId(""), 1400);
              }}
              onCopyAll={async () => {
                await copyText(buildGenerationText(result));
                setCopiedId("all");
                window.setTimeout(() => setCopiedId(""), 1400);
              }}
              onDownload={() => {
                const blob = new Blob([buildGenerationText(result)], { type: "text/plain" });
                const url = URL.createObjectURL(blob);
                const link = document.createElement("a");
                link.href = url;
                link.download = `${result.title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.txt`;
                link.click();
                URL.revokeObjectURL(url);
              }}
              isSaved={isSaved(store, result)}
            />
          </section>

          <PlatformFormatterPanel id="formatter" plan={plan} onPlanChange={setPlan} />

          <SavedLibraryPanel
            store={store}
            plan={plan}
            onPlanChange={setPlan}
            onCopy={async (item) => {
              await copyText(buildGenerationText(item));
              setCopiedId(item.id);
              window.setTimeout(() => setCopiedId(""), 1400);
            }}
            onDelete={deleteSaved}
            copiedId={copiedId}
          />
        </div>

        <HistoryPanel
          store={store}
          current={result}
          renderTimestamps={hasMounted}
          isOpen={historyOpen || menuOpen}
          onClose={() => {
            setHistoryOpen(false);
            setMenuOpen(false);
          }}
          onLoadResult={(item) => {
            setResult(item);
            setSource(item.source);
            setTone(item.tone);
            setSharpness(item.sharpness ?? "balanced");
            setCtaMode(item.ctaMode ?? "soft");
            setPresetTopic(item.presetTopic ?? "none");
            setSelectedTypes(item.selectedTypes);
            setHistoryOpen(false);
            setMenuOpen(false);
          }}
          onLoadDraft={loadDraft}
        />
      </div>

      {embedded ? null : (
        <BottomActionBar
          canGenerate={canGenerate}
          isPending={isPending}
          saved={isSaved(store, result)}
          onGenerate={() => generateContent()}
          onSave={saveCurrent}
          onSaveDraft={saveDraft}
          onOpenHistory={() => setHistoryOpen(true)}
        />
      )}
    </main>
  );
}

function TopBar({
  menuOpen,
  plan,
  onToggleMenu,
  onOpenHistory
}: {
  menuOpen: boolean;
  plan: PlanId;
  onToggleMenu: () => void;
  onOpenHistory: () => void;
}) {
  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-ink/86 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-5 lg:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <Link href="/" aria-label="Back to ContentOS homepage">
            <BrandLogo />
          </Link>
        </div>

        <div className="hidden items-center gap-3 lg:flex">
          <Link
            href="/"
            className="flex min-h-10 items-center gap-2 rounded border border-white/10 bg-white/[0.04] px-3 text-xs font-semibold text-bone transition hover:border-gold/60"
          >
            <ArrowLeft size={15} />
            Home
          </Link>
          <div className="flex items-center gap-2 rounded border border-line bg-white/[0.03] px-3 py-2 text-xs text-muted">
            <span className="h-2 w-2 rounded-full bg-goldSoft" />
            {plan === "pro" ? "Pro workspace" : "Free workspace"}
          </div>
        </div>

        <div className="flex items-center gap-2 lg:hidden">
          <Link
            href="/"
            className="grid h-10 w-10 place-items-center border border-white/10 bg-white/[0.04] text-muted"
            aria-label="Back to ContentOS homepage"
          >
            <ArrowLeft size={18} />
          </Link>
          <button
            type="button"
            onClick={onOpenHistory}
            className="grid h-10 w-10 place-items-center border border-white/10 bg-white/[0.04] text-muted"
            aria-label="Open history"
          >
            <History size={18} />
          </button>
          <button
            type="button"
            onClick={onToggleMenu}
            className="grid h-10 w-10 place-items-center border border-white/10 bg-white/[0.04] text-muted"
            aria-label="Open menu"
          >
            {menuOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
      </div>
    </header>
  );
}

type RailAction = "studio" | "drafts" | "saved" | "outputs" | "formatter";

function DesktopRail({ onNavigate }: { onNavigate: (action: RailAction) => void }) {
  const items = [
    { icon: PenLine, label: "Studio", action: "studio" as const },
    { icon: Archive, label: "Drafts", action: "drafts" as const },
    { icon: Bookmark, label: "Saved", action: "saved" as const },
    { icon: FileText, label: "Outputs", action: "outputs" as const },
    { icon: Type, label: "Formatter", action: "formatter" as const }
  ];

  return (
    <aside className="hidden rounded border border-white/10 bg-white/[0.035] p-3 lg:block">
      <div className="flex h-full flex-col items-center gap-3">
        {items.map((item) => (
          <button
            key={item.label}
            type="button"
            title={item.label}
            onClick={() => onNavigate(item.action)}
            className="grid h-11 w-11 place-items-center border border-white/10 bg-ink/80 text-muted transition hover:border-violet/60 hover:text-bone"
          >
            <item.icon size={18} />
          </button>
        ))}
      </div>
    </aside>
  );
}

function ComposerPanel({
  id,
  source,
  tone,
  sharpness,
  ctaMode,
  presetTopic,
  selectedTypes,
  brandName,
  audience,
  offer,
  brandVoice,
  contentGoal,
  plan,
  freeRemaining,
  canGenerate,
  isPending,
  onSourceChange,
  onBrandNameChange,
  onAudienceChange,
  onOfferChange,
  onBrandVoiceChange,
  onContentGoalChange,
  onToneChange,
  onSharpnessChange,
  onCtaModeChange,
  onPresetTopicChange,
  onToggleType,
  onGenerate,
  onSaveDraft,
  onPlanChange
}: {
  id: string;
  source: string;
  tone: ToneId;
  sharpness: SharpnessId;
  ctaMode: CtaModeId;
  presetTopic: PresetTopicId;
  selectedTypes: ContentTypeId[];
  brandName: string;
  audience: string;
  offer: string;
  brandVoice: string;
  contentGoal: string;
  plan: PlanId;
  freeRemaining: number;
  canGenerate: boolean;
  isPending: boolean;
  onSourceChange: (value: string) => void;
  onBrandNameChange: (value: string) => void;
  onAudienceChange: (value: string) => void;
  onOfferChange: (value: string) => void;
  onBrandVoiceChange: (value: string) => void;
  onContentGoalChange: (value: string) => void;
  onToneChange: (value: ToneId) => void;
  onSharpnessChange: (value: SharpnessId) => void;
  onCtaModeChange: (value: CtaModeId) => void;
  onPresetTopicChange: (value: PresetTopicId) => void;
  onToggleType: (value: ContentTypeId) => void;
  onGenerate: () => void;
  onSaveDraft: () => void;
  onPlanChange: (value: PlanId) => void;
}) {
  const isPro = plan === "pro";

  return (
    <section
      id={id}
      className="scroll-mt-20 min-w-0 rounded border border-white/10 bg-panel/78 p-4 shadow-violet backdrop-blur-xl sm:p-5"
    >
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl uppercase leading-none tracking-normal text-bone sm:text-4xl">
            ContentOS
          </h1>
          <p className="mt-2 max-w-sm text-sm leading-6 text-muted">
            Turn raw ideas into platform-ready content across every channel.
          </p>
        </div>
        <div className="hidden border-l border-gold/50 pl-3 text-right text-xs text-goldSoft sm:block">
          Generate.
          <br />
          Format.
          <br />
          Repurpose.
        </div>
      </div>

      <div className="mb-4 rounded border border-white/10 bg-white/[0.035] p-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-bone">
              {isPro ? "Pro access enabled" : `${freeRemaining} free generations left`}
            </p>
            <p className="mt-1 text-xs leading-5 text-muted">
              Free includes basic generation. Pro unlocks full generation, formatter presets, repurposing, and saved history.
            </p>
          </div>
          <div className="grid grid-cols-2 overflow-hidden rounded border border-white/10 bg-ink/70 sm:w-44">
            <button
              type="button"
              onClick={() => onPlanChange("free")}
              className={clsx(
                "min-h-10 px-3 text-xs font-semibold",
                !isPro ? "bg-gold/10 text-bone" : "text-muted hover:text-bone"
              )}
            >
              Free
            </button>
            <button
              type="button"
              onClick={() => onPlanChange("pro")}
              className={clsx(
                "min-h-10 border-l border-white/10 px-3 text-xs font-semibold",
                isPro ? "bg-violet/25 text-bone" : "text-muted hover:text-bone"
              )}
            >
              Pro
            </button>
          </div>
        </div>
      </div>

      <label className="text-xs font-semibold uppercase tracking-[0.18em] text-goldSoft">
        Source material
      </label>
      <textarea
        value={source}
        onChange={(event) => onSourceChange(event.target.value)}
        rows={10}
        className="studio-scroll mt-3 min-h-60 w-full resize-none rounded border border-line bg-ink/70 p-4 text-base leading-7 text-bone outline-none transition placeholder:text-muted/60 focus:border-violet/70 focus:ring-2 focus:ring-violet/20"
        placeholder="Paste notes, a voice memo transcript, a launch idea, an offer, or the messy thought you want to turn into content."
      />

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {[
          { label: "Brand/business name", value: brandName, onChange: onBrandNameChange, placeholder: "Acme Studio" },
          { label: "Target audience", value: audience, onChange: onAudienceChange, placeholder: "Busy founders and consultants" },
          { label: "Offer/product/service", value: offer, onChange: onOfferChange, placeholder: "Content planning service" },
          { label: "Content goal", value: contentGoal, onChange: onContentGoalChange, placeholder: "Generate qualified leads" }
        ].map((item) => (
          <label key={item.label} className="grid gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-goldSoft">
            {item.label}
            <input
              value={item.value}
              onChange={(event) => item.onChange(event.target.value)}
              placeholder={item.placeholder}
              className="min-h-11 rounded border border-line bg-ink/70 px-3 text-sm normal-case tracking-normal text-bone outline-none transition placeholder:text-muted/60 focus:border-violet/70 focus:ring-2 focus:ring-violet/20"
            />
          </label>
        ))}
      </div>

      <label className="mt-4 grid gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-goldSoft">
        Brand voice
        <textarea
          value={brandVoice}
          onChange={(event) => onBrandVoiceChange(event.target.value)}
          rows={3}
          placeholder="Confident, useful, concise, practical, lightly witty."
          className="studio-scroll rounded border border-line bg-ink/70 p-3 text-sm normal-case leading-6 tracking-normal text-bone outline-none transition placeholder:text-muted/60 focus:border-violet/70 focus:ring-2 focus:ring-violet/20"
        />
      </label>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={onGenerate}
          disabled={!canGenerate}
          className="flex min-h-12 items-center justify-center gap-2 rounded border border-violet/70 bg-violet px-4 text-sm font-semibold text-white shadow-violet transition hover:bg-violetDeep disabled:cursor-not-allowed disabled:border-white/10 disabled:bg-white/10 disabled:text-muted"
        >
          {isPending ? <Loader2 className="animate-spin" size={18} /> : <Wand2 size={18} />}
          Generate
        </button>
        <button
          type="button"
          onClick={onSaveDraft}
          className="flex min-h-12 items-center justify-center gap-2 rounded border border-white/10 bg-white/[0.04] px-4 text-sm font-semibold text-bone transition hover:border-gold/60"
        >
          <Save size={17} />
          Save draft
        </button>
      </div>

      <div className="mt-5">
        <div className="mb-2 flex items-center justify-between gap-3">
          <label
            htmlFor="preset-topic"
            className="text-xs font-semibold uppercase tracking-[0.18em] text-goldSoft"
          >
            Topic
          </label>
          <p className="truncate text-xs text-muted">{labelForPresetTopic(presetTopic)}</p>
        </div>
        <select
          id="preset-topic"
          value={presetTopic}
          onChange={(event) => onPresetTopicChange(event.target.value as PresetTopicId)}
          className="min-h-12 w-full rounded border border-line bg-ink/70 px-3 text-sm font-semibold text-bone outline-none transition focus:border-violet/70 focus:ring-2 focus:ring-violet/20"
        >
          {presetTopics.map((topic) => (
            <option key={topic.id} value={topic.id} className="bg-ink text-bone">
              {topic.label}
            </option>
          ))}
        </select>
      </div>

      <div className="mt-5">
        <div className="mb-2 flex items-center justify-between gap-3">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-goldSoft">
            Tone
          </p>
          <p className="text-xs text-muted">{labelForTone(tone)}</p>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          {tones.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => onToneChange(item.id)}
              className={clsx(
                "rounded border p-3 text-left transition",
                tone === item.id
                  ? "border-gold/70 bg-gold/10 text-bone"
                  : "border-white/10 bg-white/[0.035] text-muted hover:border-violet/60"
              )}
            >
              <span className="block text-sm font-semibold text-bone">{item.label}</span>
              <span className="mt-1 block text-xs leading-5">{item.description}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="mt-5">
        <div className="mb-2 flex items-center justify-between gap-3">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-goldSoft">
            Sharpness
          </p>
          <p className="text-xs text-muted">{labelForSharpness(sharpness)}</p>
        </div>
        <div className="grid grid-cols-4 overflow-hidden rounded border border-white/10 bg-white/[0.03]">
          {sharpnessModes.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => onSharpnessChange(item.id)}
              title={item.description}
              className={clsx(
                "min-h-11 border-r border-white/10 px-2 text-xs font-semibold transition last:border-r-0",
                sharpness === item.id
                  ? "bg-violet/25 text-bone"
                  : "text-muted hover:bg-white/[0.04] hover:text-bone"
              )}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-5">
        <div className="mb-2 flex items-center justify-between gap-3">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-goldSoft">
            CTA
          </p>
          <p className="text-xs text-muted">{labelForCtaMode(ctaMode)}</p>
        </div>
        <div className="studio-scroll flex gap-2 overflow-x-auto pb-1">
          {ctaModes.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => onCtaModeChange(item.id)}
              title={item.description}
              className={clsx(
                "min-h-10 shrink-0 rounded border px-3 text-sm transition",
                ctaMode === item.id
                  ? "border-gold/70 bg-gold/10 text-bone"
                  : "border-white/10 bg-white/[0.03] text-muted hover:border-violet/50"
              )}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-5">
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-goldSoft">
          Content types
        </p>
        <div className="studio-scroll flex snap-x gap-2 overflow-x-auto pb-2 lg:flex-wrap lg:overflow-visible">
          {contentTypes.map((item) => {
            const active = selectedTypes.includes(item.id);
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onToggleType(item.id)}
                title={item.paidOnly && !isPro ? "Pro output" : item.label}
                className={clsx(
                  "flex min-h-10 shrink-0 snap-start items-center gap-2 rounded border px-3 text-sm transition",
                  active
                    ? "border-violet/70 bg-violet/20 text-bone"
                    : "border-white/10 bg-white/[0.03] text-muted hover:border-violet/50"
                )}
              >
                {item.paidOnly && !isPro ? (
                  <Lock size={13} />
                ) : active ? (
                  <Check size={14} />
                ) : (
                  <span className="h-3.5 w-3.5 rounded border border-current" />
                )}
                {item.shortLabel}
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function OutputPanel({
  id,
  result,
  activeFilter,
  visibleSections,
  error,
  copiedId,
  isPending,
  isSaved,
  onFilterChange,
  onCopySection,
  onRegenerate,
  onSaveCurrent,
  onCopyRefinement,
  onCopyAll,
  onDownload
}: {
  id: string;
  result: GenerationResult;
  activeFilter: FilterId;
  visibleSections: GeneratedSection[];
  error: string;
  copiedId: string;
  isPending: boolean;
  isSaved: boolean;
  onFilterChange: (value: FilterId) => void;
  onCopySection: (section: GeneratedSection) => void;
  onRegenerate: () => void;
  onSaveCurrent: () => void;
  onCopyRefinement: (section: GeneratedSection, action: string) => void;
  onCopyAll: () => void;
  onDownload: () => void;
}) {
  return (
    <section
      id={id}
      className="scroll-mt-20 min-w-0 rounded border border-white/10 bg-coal/86 p-4 backdrop-blur-xl sm:p-5"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-goldSoft">
            Output workspace
          </p>
          <h2 className="mt-2 truncate font-display text-2xl uppercase tracking-normal text-bone">
            {result.title}
          </h2>
          <p className="mt-2 text-sm leading-6 text-muted">{result.summary}</p>
        </div>
        <button
          type="button"
          onClick={onSaveCurrent}
          className={clsx(
            "grid h-11 w-11 shrink-0 place-items-center rounded border transition",
            isSaved
              ? "border-gold/70 bg-gold/15 text-goldSoft"
              : "border-white/10 bg-white/[0.04] text-muted hover:border-gold/60"
          )}
          aria-label="Save output"
        >
          {isSaved ? <BookmarkCheck size={18} /> : <Bookmark size={18} />}
        </button>
      </div>

      {error ? (
        <div className="mt-4 rounded border border-gold/40 bg-gold/10 p-3 text-sm leading-6 text-bone">
          {error}
        </div>
      ) : null}

      <div className="studio-scroll mt-4 flex gap-2 overflow-x-auto pb-2">
        {filters.map((filter) => (
          <button
            key={filter.id}
            type="button"
            onClick={() => onFilterChange(filter.id)}
            className={clsx(
              "min-h-10 shrink-0 rounded border px-3 text-sm transition",
              activeFilter === filter.id
                ? "border-gold/70 bg-gold/10 text-bone"
                : "border-white/10 bg-white/[0.035] text-muted hover:border-violet/50"
            )}
          >
            {filter.label}
          </button>
        ))}
      </div>

      <div className="mt-3 grid gap-3">
        {isPending ? (
          <LoadingCard />
        ) : visibleSections.length ? (
          visibleSections.map((section) => (
            <OutputCard
              key={section.id}
              section={section}
              copied={copiedId === section.id}
              onCopy={() => onCopySection(section)}
              onCopyRefinement={(action) => onCopyRefinement(section, action)}
            />
          ))
        ) : (
          <div className="rounded border border-white/10 bg-white/[0.03] p-4 text-sm text-muted">
            No outputs in this filter yet.
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={onRegenerate}
        disabled={isPending}
        className="mt-4 flex min-h-11 w-full items-center justify-center gap-2 rounded border border-white/10 bg-white/[0.04] px-4 text-sm font-semibold text-bone transition hover:border-violet/60 disabled:cursor-not-allowed disabled:text-muted"
      >
        <RefreshCcw size={17} />
        Regenerate current set
      </button>
      <div className="mt-2 grid gap-2 sm:grid-cols-3">
        <button
          type="button"
          onClick={onCopyAll}
          className="flex min-h-11 items-center justify-center gap-2 rounded border border-white/10 bg-white/[0.04] px-4 text-sm font-semibold text-bone transition hover:border-violet/60"
        >
          <Copy size={16} />
          {copiedId === "all" ? "Copied" : "Copy all"}
        </button>
        <button
          type="button"
          onClick={onDownload}
          className="flex min-h-11 items-center justify-center gap-2 rounded border border-white/10 bg-white/[0.04] px-4 text-sm font-semibold text-bone transition hover:border-violet/60"
        >
          <FileText size={16} />
          Download .txt
        </button>
        <button
          type="button"
          onClick={onSaveCurrent}
          className="flex min-h-11 items-center justify-center gap-2 rounded border border-white/10 bg-white/[0.04] px-4 text-sm font-semibold text-bone transition hover:border-gold/60"
        >
          <Bookmark size={16} />
          Save all
        </button>
      </div>
    </section>
  );
}

function PlatformFormatterPanel({
  id,
  plan,
  onPlanChange
}: {
  id: string;
  plan: PlanId;
  onPlanChange: (value: PlanId) => void;
}) {
  const [text, setText] = useState(formatterStarterText);
  const [previewMode, setPreviewMode] = useState<FormatterMode>("desktop");
  const [platform, setPlatform] = useState<FormatterPlatform>("linkedin");
  const [copied, setCopied] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const isPro = plan === "pro";
  const activePlatform = formatterPlatforms.find((item) => item.id === platform) ?? formatterPlatforms[0];

  function replaceSelection(transform: (value: string) => string) {
    const textarea = textareaRef.current;
    if (!textarea) {
      setText((current) => transform(current));
      return;
    }

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const hasSelection = start !== end;
    const targetText = hasSelection ? text.slice(start, end) : text;
    const replacement = transform(targetText);
    const nextText = hasSelection
      ? `${text.slice(0, start)}${replacement}${text.slice(end)}`
      : replacement;

    setText(nextText);
    window.requestAnimationFrame(() => {
      textarea.focus();
      if (hasSelection) {
        textarea.setSelectionRange(start, start + replacement.length);
      }
    });
  }

  function applyStyle(style: TextStyle) {
    replaceSelection((value) => styleText(value, style));
  }

  function applyList(numbered: boolean) {
    replaceSelection((value) => prefixSelectedLines(value, numbered));
  }

  async function copyFormattedText() {
    if (!isPro) {
      onPlanChange("pro");
      return;
    }

    await copyText(text);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
  }

  function applyPlatformTemplate(nextPlatform: FormatterPlatform) {
    setPlatform(nextPlatform);

    if (!isPro) {
      return;
    }

    if (nextPlatform === "xThread") {
      setText((current) =>
        current
          .split(/\n{2,}/)
          .filter(Boolean)
          .map((line, index) => `${index + 1}. ${line.replace(/^\d+\.\s*/, "")}`)
          .join("\n\n")
      );
    }

    if (nextPlatform === "shortVideoScript") {
      setText((current) => `Hook:\n${current.split("\n")[0] ?? ""}\n\nBeat 1:\n\nBeat 2:\n\nOn-screen text:\n\nClose:`);
    }
  }

  return (
    <section
      id={id}
      className="scroll-mt-20 rounded border border-white/10 bg-panel/78 p-4 shadow-violet backdrop-blur-xl sm:p-5"
    >
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-goldSoft">
            Platform formatter
          </p>
          <h2 className="mt-2 font-display text-2xl uppercase tracking-normal text-bone">
            Format Platform Text
          </h2>
          <p className="mt-2 max-w-xl text-sm leading-6 text-muted">
            Format LinkedIn posts, Instagram captions, TikTok captions, X threads, and short-form video scripts.
          </p>
        </div>

        <div className="grid grid-cols-2 overflow-hidden rounded border border-white/10 bg-white/[0.03] sm:w-48">
          <button
            type="button"
            onClick={() => setPreviewMode("desktop")}
            className={clsx(
              "flex min-h-10 items-center justify-center gap-2 border-r border-white/10 px-3 text-xs font-semibold",
              previewMode === "desktop"
                ? "bg-gold/10 text-bone"
                : "text-muted hover:text-bone"
            )}
          >
            <Monitor size={15} />
            Desktop
          </button>
          <button
            type="button"
            onClick={() => setPreviewMode("mobile")}
            className={clsx(
              "flex min-h-10 items-center justify-center gap-2 px-3 text-xs font-semibold",
              previewMode === "mobile"
                ? "bg-gold/10 text-bone"
                : "text-muted hover:text-bone"
            )}
          >
            <Smartphone size={15} />
            Mobile
          </button>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
        <div className="min-w-0">
          <div className="studio-scroll mb-3 flex gap-2 overflow-x-auto pb-1">
            {formatterPlatforms.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => applyPlatformTemplate(item.id)}
                className={clsx(
                  "min-h-10 shrink-0 rounded border px-3 text-sm font-semibold transition",
                  platform === item.id
                    ? "border-gold/70 bg-gold/10 text-bone"
                    : "border-white/10 bg-white/[0.035] text-muted hover:border-violet/50"
                )}
              >
                {item.label}
              </button>
            ))}
          </div>

          <div className="studio-scroll mb-3 flex gap-2 overflow-x-auto pb-1">
            <FormatterButton label="Bold" onClick={() => applyStyle("bold")}>
              <Bold size={16} />
            </FormatterButton>
            <FormatterButton label="Italic" onClick={() => applyStyle("italic")}>
              <Italic size={16} />
            </FormatterButton>
            <FormatterButton
              label="Bold Italic"
              onClick={() => applyStyle("boldItalic")}
            >
              <span className="text-xs font-black italic">BI</span>
            </FormatterButton>
            <FormatterButton label="Underline" onClick={() => applyStyle("underline")}>
              <Underline size={16} />
            </FormatterButton>
            <FormatterButton
              label="Strikethrough"
              onClick={() => applyStyle("strikethrough")}
            >
              <Strikethrough size={16} />
            </FormatterButton>
            <FormatterButton label="Bullets" onClick={() => applyList(false)}>
              <List size={16} />
            </FormatterButton>
            <FormatterButton label="Numbers" onClick={() => applyList(true)}>
              <ListOrdered size={16} />
            </FormatterButton>
          </div>

          <textarea
            ref={textareaRef}
            value={text}
            onChange={(event) => setText(event.target.value)}
            rows={12}
            className="studio-scroll min-h-80 w-full resize-none rounded border border-line bg-ink/70 p-4 text-base leading-7 text-bone outline-none transition placeholder:text-muted/60 focus:border-violet/70 focus:ring-2 focus:ring-violet/20"
            placeholder="Write or paste platform copy here."
          />

          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-[1fr_auto_auto]">
            <p className="col-span-2 self-center text-xs text-muted sm:col-span-1">
              {text.length.toLocaleString()} characters
            </p>
            <button
              type="button"
              onClick={() => setText("")}
              className="flex min-h-11 items-center justify-center gap-2 rounded border border-white/10 bg-white/[0.04] px-4 text-sm font-semibold text-bone transition hover:border-violet/60"
            >
              <Eraser size={16} />
              Clear
            </button>
            <button
              type="button"
              onClick={copyFormattedText}
              className="flex min-h-11 items-center justify-center gap-2 rounded border border-violet/70 bg-violet px-4 text-sm font-semibold text-white shadow-violet transition hover:bg-violetDeep"
            >
              {copied ? <Check size={16} /> : <Copy size={16} />}
              {isPro ? (copied ? "Copied" : "Copy") : "Unlock"}
            </button>
          </div>
        </div>

        <div
          className={clsx(
            "min-w-0 rounded border border-white/10 bg-ink/70 p-4",
            previewMode === "mobile" ? "mx-auto w-full max-w-sm" : "w-full"
          )}
        >
          <div className="rounded bg-[#f4f2ee] p-4 text-[#191919]">
            <div className="flex items-start gap-3">
              <div className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-[#231832] text-sm font-bold text-[#e0bb58]">
                CO
              </div>
              <div className="min-w-0">
                <p className="font-semibold leading-5">Creator Studio</p>
                <p className="text-xs leading-4 text-[#666666]">
                  {activePlatform.title} | ContentOS
                </p>
                <p className="text-xs leading-4 text-[#666666]">12h •</p>
              </div>
            </div>

            <p className="mt-4 text-xs font-semibold uppercase tracking-normal text-[#666666]">
              {activePlatform.helper}
            </p>
            <p className="mt-4 whitespace-pre-wrap text-sm leading-6">
              {text || "Your formatted platform preview will appear here."}
            </p>

            <div className="mt-4 flex items-center justify-between border-t border-[#d6d3cc] pt-3 text-xs text-[#666666]">
              <span>Like</span>
              <span>Comment</span>
              <span>Share</span>
              <span>Send</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function FormatterButton({
  label,
  onClick,
  children
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={label}
      onClick={onClick}
      className="grid h-10 w-10 shrink-0 place-items-center rounded border border-white/10 bg-white/[0.04] text-bone transition hover:border-violet/60"
      aria-label={label}
    >
      {children}
    </button>
  );
}

function OutputCard({
  section,
  copied,
  onCopy,
  onCopyRefinement
}: {
  section: GeneratedSection;
  copied: boolean;
  onCopy: () => void;
  onCopyRefinement: (action: string) => void;
}) {
  return (
    <article className="rounded border border-white/10 bg-white/[0.035] p-4">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-[0.18em] text-violet">
            {section.platform}
          </p>
          <h3 className="mt-1 text-lg font-semibold text-bone">{section.title}</h3>
          <p className="mt-1 text-xs text-muted">{labelForContentType(section.type)}</p>
        </div>
        <button
          type="button"
          onClick={onCopy}
          className="flex min-h-10 shrink-0 items-center gap-2 rounded border border-white/10 bg-ink/70 px-3 text-xs font-semibold text-bone transition hover:border-violet/60"
        >
          {copied ? <Check size={15} /> : <Copy size={15} />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>

      {section.body ? (
        <p className="whitespace-pre-line text-[0.95rem] leading-7 text-bone/92">
          {section.body}
        </p>
      ) : null}

      {section.items.length ? (
        <ul className="mt-4 grid gap-2">
          {section.items.map((item) => (
            <li
              key={item}
              className="border-l-2 border-gold/70 bg-ink/42 py-2 pl-3 text-sm leading-6 text-muted"
            >
              {item}
            </li>
          ))}
        </ul>
      ) : null}

      {section.cta ? (
        <div className="mt-4 rounded border border-violet/40 bg-violet/10 p-3 text-sm leading-6 text-bone">
          {section.cta}
        </div>
      ) : null}
      <div className="studio-scroll mt-4 flex gap-2 overflow-x-auto pb-1">
        {[
          "shorten",
          "expand",
          "simplify",
          "more persuasive",
          "more casual",
          "more professional",
          "improve hook",
          "improve CTA"
        ].map((action) => (
          <button
            key={action}
            type="button"
            onClick={() => onCopyRefinement(action)}
            className="min-h-9 shrink-0 rounded border border-white/10 bg-ink/70 px-3 text-xs font-semibold text-muted transition hover:border-violet/60 hover:text-bone"
          >
            {action}
          </button>
        ))}
      </div>
    </article>
  );
}

function LoadingCard() {
  return (
    <div className="rounded border border-violet/30 bg-violet/10 p-5">
      <div className="flex items-center gap-3">
        <Loader2 className="animate-spin text-goldSoft" size={20} />
        <div>
          <p className="font-semibold text-bone">Building the content set</p>
          <p className="mt-1 text-sm text-muted">
            Structuring it for clean platform-ready reuse.
          </p>
        </div>
      </div>
    </div>
  );
}

function SavedLibraryPanel({
  store,
  plan,
  copiedId,
  onPlanChange,
  onCopy,
  onDelete
}: {
  store: StudioStore;
  plan: PlanId;
  copiedId: string;
  onPlanChange: (value: PlanId) => void;
  onCopy: (value: GenerationResult) => void;
  onDelete: (id: string) => void;
}) {
  const [platformFilter, setPlatformFilter] = useState<FilterId>("all");
  const [categoryFilter, setCategoryFilter] = useState<PresetTopicId>("none");
  const isPro = plan === "pro";

  const filtered = store.saved.filter((item) => {
    const matchesCategory =
      categoryFilter === "none" || item.presetTopic === categoryFilter;
    const matchesPlatform =
      platformFilter === "all" ||
      item.sections.some((section) => sectionMatchesFilter(section, platformFilter));

    return matchesCategory && matchesPlatform;
  });

  return (
    <section className="scroll-mt-20 rounded border border-white/10 bg-coal/86 p-4 backdrop-blur-xl sm:p-5">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-goldSoft">
            Saved library
          </p>
          <h2 className="mt-2 font-display text-2xl uppercase tracking-normal text-bone">
            Organized Outputs
          </h2>
          <p className="mt-2 max-w-xl text-sm leading-6 text-muted">
            Save generated sets, filter by platform or category, copy them back out, and remove anything you no longer need.
          </p>
        </div>
        {!isPro ? (
          <button
            type="button"
            onClick={() => onPlanChange("pro")}
            className="flex min-h-11 items-center justify-center gap-2 rounded border border-violet/70 bg-violet px-4 text-sm font-semibold text-white shadow-violet transition hover:bg-violetDeep"
          >
            <Lock size={16} />
            Unlock library
          </button>
        ) : null}
      </div>

      {!isPro ? (
        <div className="rounded border border-white/10 bg-white/[0.035] p-4 text-sm leading-6 text-muted">
          Saved history is part of the Pro placeholder plan. The switch above simulates entitlement only, no payment is processed.
        </div>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            <select
              value={platformFilter}
              onChange={(event) => setPlatformFilter(event.target.value as FilterId)}
              className="min-h-11 rounded border border-line bg-ink/70 px-3 text-sm font-semibold text-bone outline-none transition focus:border-violet/70 focus:ring-2 focus:ring-violet/20"
            >
              {filters
                .filter((filter) => filter.id !== "saved")
                .map((filter) => (
                  <option key={filter.id} value={filter.id} className="bg-ink text-bone">
                    {filter.label}
                  </option>
                ))}
            </select>
            <select
              value={categoryFilter}
              onChange={(event) => setCategoryFilter(event.target.value as PresetTopicId)}
              className="min-h-11 rounded border border-line bg-ink/70 px-3 text-sm font-semibold text-bone outline-none transition focus:border-violet/70 focus:ring-2 focus:ring-violet/20"
            >
              {presetTopics.map((topic) => (
                <option key={topic.id} value={topic.id} className="bg-ink text-bone">
                  {topic.label}
                </option>
              ))}
            </select>
          </div>

          <div className="mt-4 grid gap-3">
            {filtered.length ? (
              filtered.map((item) => (
                <article
                  key={item.id}
                  className="rounded border border-white/10 bg-white/[0.035] p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="line-clamp-2 text-base font-semibold text-bone">
                        {item.title}
                      </h3>
                      <p className="mt-1 text-xs text-muted">
                        {labelForPresetTopic(item.presetTopic ?? "none")} · {item.sections.length} outputs
                      </p>
                    </div>
                    <div className="flex shrink-0 gap-2">
                      <button
                        type="button"
                        onClick={() => onCopy(item)}
                        className="grid h-10 w-10 place-items-center rounded border border-white/10 bg-ink/70 text-bone transition hover:border-violet/60"
                        aria-label="Copy saved content"
                      >
                        {copiedId === item.id ? <Check size={16} /> : <Copy size={16} />}
                      </button>
                      <button
                        type="button"
                        onClick={() => onDelete(item.id)}
                        className="grid h-10 w-10 place-items-center rounded border border-white/10 bg-ink/70 text-muted transition hover:border-gold/60 hover:text-bone"
                        aria-label="Delete saved content"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                </article>
              ))
            ) : (
              <div className="rounded border border-white/10 bg-white/[0.03] p-4 text-sm text-muted">
                No saved outputs match these filters yet.
              </div>
            )}
          </div>
        </>
      )}
    </section>
  );
}

function HistoryPanel({
  store,
  current,
  renderTimestamps,
  isOpen,
  onClose,
  onLoadResult,
  onLoadDraft
}: {
  store: StudioStore;
  current: GenerationResult;
  renderTimestamps: boolean;
  isOpen: boolean;
  onClose: () => void;
  onLoadResult: (value: GenerationResult) => void;
  onLoadDraft: (value: Draft) => void;
}) {
  const recent = store.recent.length ? store.recent : [current];

  return (
    <>
      <button
        type="button"
        aria-label="Close history"
        onClick={onClose}
        className={clsx(
          "fixed inset-0 z-40 bg-black/60 transition lg:hidden",
          isOpen ? "opacity-100" : "pointer-events-none opacity-0"
        )}
      />
      <aside
        className={clsx(
          "fixed bottom-0 right-0 top-0 z-50 w-full max-w-md border-l border-white/10 bg-coal p-4 transition-transform duration-300 lg:static lg:z-auto lg:block lg:max-w-none lg:translate-x-0 lg:rounded lg:border lg:bg-white/[0.035] lg:p-4",
          isOpen ? "translate-x-0" : "translate-x-full lg:translate-x-0"
        )}
      >
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-goldSoft">
              History
            </p>
            <h2 className="mt-1 text-lg font-semibold text-bone">Recent work</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid h-10 w-10 place-items-center border border-white/10 bg-white/[0.04] text-muted lg:hidden"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        <div className="studio-scroll max-h-[calc(100vh-7rem)] space-y-5 overflow-y-auto pr-1">
          <HistoryGroup
            title="Recent generations"
            empty="Generated work will appear here."
            items={recent}
            render={(item) => (
              <HistoryButton
                key={item.id}
                title={item.title}
                meta={
                  renderTimestamps
                    ? `${formatDate(item.createdAt)} · ${labelForTone(item.tone)}`
                    : labelForTone(item.tone)
                }
                onClick={() => onLoadResult(item)}
              />
            )}
          />

          <HistoryGroup
            title="Saved outputs"
            empty="Saved outputs will appear here."
            items={store.saved}
            render={(item) => (
              <HistoryButton
                key={item.id}
                title={item.title}
                meta={
                  renderTimestamps
                    ? `${formatDate(item.createdAt)} · ${item.sections.length} sections`
                    : `${item.sections.length} sections`
                }
                onClick={() => onLoadResult(item)}
              />
            )}
          />

          <HistoryGroup
            id="history-drafts"
            title="Drafts"
            empty="Drafts will appear here."
            items={store.drafts}
            render={(item) => (
              <HistoryButton
                key={item.id}
                title={item.title}
                meta={
                  renderTimestamps
                    ? `${formatDate(item.updatedAt)} · ${labelForTone(item.tone)}`
                    : labelForTone(item.tone)
                }
                onClick={() => onLoadDraft(item)}
              />
            )}
          />
        </div>
      </aside>
    </>
  );
}

function HistoryGroup<T>({
  id,
  title,
  empty,
  items,
  render
}: {
  id?: string;
  title: string;
  empty: string;
  items: T[];
  render: (item: T) => React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-4">
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-muted">
        {title}
      </h3>
      <div className="grid gap-2">
        {items.length ? (
          items.map(render)
        ) : (
          <p className="rounded border border-white/10 bg-white/[0.03] p-3 text-sm text-muted">
            {empty}
          </p>
        )}
      </div>
    </section>
  );
}

function HistoryButton({
  title,
  meta,
  onClick
}: {
  title: string;
  meta: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex min-h-16 w-full items-center justify-between gap-3 rounded border border-white/10 bg-ink/55 p-3 text-left transition hover:border-violet/60"
    >
      <span className="min-w-0">
        <span className="line-clamp-2 block text-sm font-semibold leading-5 text-bone">
          {title}
        </span>
        <span className="mt-1 block truncate text-xs text-muted">{meta}</span>
      </span>
      <ChevronRight className="shrink-0 text-goldSoft" size={17} />
    </button>
  );
}

function BottomActionBar({
  canGenerate,
  isPending,
  saved,
  onGenerate,
  onSave,
  onSaveDraft,
  onOpenHistory
}: {
  canGenerate: boolean;
  isPending: boolean;
  saved: boolean;
  onGenerate: () => void;
  onSave: () => void;
  onSaveDraft: () => void;
  onOpenHistory: () => void;
}) {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-white/10 bg-ink/92 px-3 py-3 backdrop-blur-xl lg:hidden">
      <div className="mx-auto grid max-w-md grid-cols-4 gap-2">
        <button
          type="button"
          onClick={onGenerate}
          disabled={!canGenerate}
          className="flex min-h-12 flex-col items-center justify-center gap-1 rounded border border-violet/70 bg-violet text-[0.68rem] font-semibold text-white disabled:border-white/10 disabled:bg-white/10 disabled:text-muted"
        >
          {isPending ? <Loader2 className="animate-spin" size={17} /> : <Sparkles size={17} />}
          Generate
        </button>
        <button
          type="button"
          onClick={onSave}
          className="flex min-h-12 flex-col items-center justify-center gap-1 rounded border border-white/10 bg-white/[0.04] text-[0.68rem] font-semibold text-bone"
        >
          {saved ? <BookmarkCheck size={17} /> : <Bookmark size={17} />}
          Save
        </button>
        <button
          type="button"
          onClick={onSaveDraft}
          className="flex min-h-12 flex-col items-center justify-center gap-1 rounded border border-white/10 bg-white/[0.04] text-[0.68rem] font-semibold text-bone"
        >
          <Clipboard size={17} />
          Draft
        </button>
        <button
          type="button"
          onClick={onOpenHistory}
          className="flex min-h-12 flex-col items-center justify-center gap-1 rounded border border-white/10 bg-white/[0.04] text-[0.68rem] font-semibold text-bone"
        >
          <History size={17} />
          History
        </button>
      </div>
    </nav>
  );
}
