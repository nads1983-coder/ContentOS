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
import { CheckoutButton } from "@/components/billing-buttons";
import { BrandLogo } from "@/components/brand-logo";
import { LogoutButton } from "@/components/logout-button";
import {
  buildGenerationCopyText,
  buildSectionCopyText,
  copyPlainText
} from "@/lib/copy";
import { formatOutputSection, OutputBlock } from "@/lib/output-format";
import { cleanPlainText } from "@/lib/text-normalize";
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
  cleanGenerationResult,
  monthlyStoredGenerationCount,
  readStore,
  toggleSaved,
  removeSaved,
  upsertDraft,
  writeStore
} from "@/lib/storage";
import { buildUsageSummary } from "@/lib/usage";
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
import type { UsageSummary } from "@/types/saas";

const starterText =
  "We just launched a lightweight planning service for busy founders who need consistent content but do not have time to turn every idea into platform-ready posts.";

const LAST_USED_TONE_KEY = "contentos:last-used-tone";

const sampleCreatedAt = "";

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
        "Consistent content does not usually fail because founders have no ideas.\n\nIt fails because the ideas stay scattered across notes, calls, and half-written drafts.\n\nThat is the gap our new planning service is built for.\n\nWe take the raw thinking you already have and turn it into a usable content system, posts, captions, scripts, and repurposing paths that match the way your business actually sells.\n\nThe goal is not more noise.\n\nIt is a cleaner way to show up with useful ideas, clear offers, and enough structure to stay consistent.",
      items: ["Strong hook", "Short paragraphs", "Practical service positioning"],
      cta: "What part of your content workflow slows you down the most?"
    },
    {
      id: "sample-instagram",
      type: "instagram",
      title: "Instagram Caption",
      platform: "Instagram",
      body:
        "Your best content ideas are probably already sitting somewhere.\n\nIn a note.\nIn a client call.\nIn a messy draft.\nIn the thing you explain every week.\n\nThe hard part is turning those ideas into posts you can actually use across platforms.\n\nThat is what our new planning service is designed to make easier.",
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

function formatDate(value?: string | null) {
  if (!value) {
    return "Date unavailable";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Date unavailable";
  }

  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(date);
}

function labelForPlan(plan: PlanId) {
  if (plan === "pro_studio") {
    return "Pro Plan";
  }

  if (plan === "founder") {
    return "Founder Plan";
  }

  if (plan === "pro_creator") {
    return "Creator Plan";
  }

  return "Free Plan";
}

function isEditableTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  return Boolean(
    target.closest("input, textarea, select, [contenteditable='true'], [contenteditable='']")
  );
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
  return buildGenerationCopyText(result);
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

function imageFilename(title: string) {
  return `${title.toLowerCase().replace(/[^a-z0-9]+/g, "-") || "contentos-image"}.png`;
}

function downloadDataUrl(dataUrl: string, filename: string) {
  const link = document.createElement("a");
  link.href = dataUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
}

async function downloadVisualAsPng(dataUrl: string, filename: string) {
  if (!dataUrl.startsWith("data:image/svg+xml")) {
    downloadDataUrl(dataUrl, filename);
    return;
  }

  const image = new Image();
  image.decoding = "async";
  const loaded = new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = () => reject(new Error("Unable to prepare PNG download."));
  });
  image.src = dataUrl;
  await loaded;

  const canvas = document.createElement("canvas");
  canvas.width = image.naturalWidth || 1080;
  canvas.height = image.naturalHeight || 1080;
  const context = canvas.getContext("2d");

  if (!context) {
    downloadDataUrl(dataUrl, filename.replace(/\.png$/i, ".svg"));
    return;
  }

  context.drawImage(image, 0, 0);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png", 0.95));

  if (!blob) {
    downloadDataUrl(dataUrl, filename.replace(/\.png$/i, ".svg"));
    return;
  }

  const objectUrl = URL.createObjectURL(blob);
  downloadDataUrl(objectUrl, filename);
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
}

type FormatterMode = "desktop" | "mobile";
type PlanId = "free" | "founder" | "pro_creator" | "pro_studio";
type FormatterPlatform = "linkedin" | "instagram" | "tiktok" | "xThread" | "shortVideoScript";
type TextStyle = "bold" | "italic" | "boldItalic" | "underline" | "strikethrough";
type ImageStyle = "minimal" | "premium" | "corporate" | "bold" | "dark" | "modern";
type ImageFormat = "square" | "landscape" | "portrait" | "vertical";

type GeneratedImage = {
  image: string;
  mimeType?: string;
  size: string;
  style: ImageStyle;
  format: ImageFormat;
  template?: string;
  warning?: string;
  createdAt: string;
};

const imageStyles: Array<{ id: ImageStyle; label: string }> = [
  { id: "minimal", label: "Minimal" },
  { id: "premium", label: "Premium" },
  { id: "corporate", label: "Corporate" },
  { id: "bold", label: "Bold" },
  { id: "dark", label: "Dark" },
  { id: "modern", label: "Modern" }
];

const imageFormats: Array<{ id: ImageFormat; label: string; helper: string }> = [
  { id: "square", label: "Square 1:1", helper: "1080 x 1080" },
  { id: "portrait", label: "Instagram 4:5", helper: "1080 x 1350" },
  { id: "vertical", label: "Shorts 9:16", helper: "1080 x 1920" },
  { id: "landscape", label: "Blog / LinkedIn 16:9", helper: "1536 x 864" }
];

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

function formatFormatterPlainText(value: string) {
  return cleanPlainText(value);
}

export function StudioShell({
  embedded = false,
  initialPlan = "free",
  authenticated = false,
  initialUsage
}: {
  embedded?: boolean;
  initialPlan?: PlanId;
  authenticated?: boolean;
  initialUsage?: UsageSummary;
}) {
  const [source, setSource] = useState(cleanPlainText(starterText));
  const [brandName, setBrandName] = useState("");
  const [audience, setAudience] = useState("");
  const [offer, setOffer] = useState("");
  const [writingStyle, setWritingStyle] = useState("");
  const [contentGoal, setContentGoal] = useState("");
  const [tone, setTone] = useState<ToneId>("professional");
  const [lastUsedTone, setLastUsedTone] = useState<ToneId | null>(null);
  const [sharpness, setSharpness] = useState<SharpnessId>("balanced");
  const [ctaMode, setCtaMode] = useState<CtaModeId>("soft");
  const [presetTopic, setPresetTopic] = useState<PresetTopicId>("business");
  const [selectedTypes, setSelectedTypes] = useState<ContentTypeId[]>(defaultSelectedTypes);
  const [activeFilter, setActiveFilter] = useState<FilterId>("all");
  const [plan, setPlan] = useState<PlanId>(initialPlan);
  const [store, setStore] = useState<StudioStore>({
    version: 1,
    recent: [],
    saved: [],
    drafts: []
  });
  const [hasMounted, setHasMounted] = useState(false);
  const [usageUsed, setUsageUsed] = useState(initialUsage?.used ?? 0);
  const [anonymousUsed, setAnonymousUsed] = useState(0);
  const [result, setResult] = useState<GenerationResult>(sampleResult);
  const [error, setError] = useState("");
  const [copiedId, setCopiedId] = useState("");
  const [historyOpen, setHistoryOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const [imageSection, setImageSection] = useState<GeneratedSection | null>(null);
  const [imageStyle, setImageStyle] = useState<ImageStyle>("premium");
  const [imageFormat, setImageFormat] = useState<ImageFormat>("square");
  const [imageBrandColors, setImageBrandColors] = useState("Deep black, royal purple, refined gold, warm off-white");
  const [imageVisualStyle, setImageVisualStyle] = useState("Premium dark SaaS editorial, clean depth, modern creator/business aesthetic");
  const [imagePending, setImagePending] = useState(false);
  const [imageError, setImageError] = useState("");
  const [generatedImages, setGeneratedImages] = useState<Record<string, GeneratedImage>>({});
  const outputWorkspaceRef = useRef<HTMLElement | null>(null);
  const pendingAutoScrollIdRef = useRef("");
  const lastAutoScrolledIdRef = useRef("");
  const isGeneratingRef = useRef(false);
  const userInteractedDuringGenerationRef = useRef(false);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      const nextStore = readStore();
      const storedTone = window.localStorage.getItem(LAST_USED_TONE_KEY) as ToneId | null;

      setStore(nextStore);
      if (storedTone && tones.some((item) => item.id === storedTone)) {
        setTone(storedTone);
        setLastUsedTone(storedTone);
      }
      if (!authenticated) {
        setAnonymousUsed(monthlyStoredGenerationCount(nextStore));
      }
      setHasMounted(true);
    }, 0);

    return () => window.clearTimeout(timeout);
  }, [authenticated]);

  useEffect(() => {
    if (!hasMounted) {
      return;
    }

    writeStore(store);
  }, [hasMounted, store]);

  useEffect(() => {
    isGeneratingRef.current = isPending;
  }, [isPending]);

  useEffect(() => {
    const markUserInteraction = (event: Event) => {
      if (event.type === "keydown" && isEditableTarget(event.target)) {
        return;
      }

      if (isGeneratingRef.current) {
        userInteractedDuringGenerationRef.current = true;
      }
    };

    window.addEventListener("wheel", markUserInteraction, { passive: true });
    window.addEventListener("touchmove", markUserInteraction, { passive: true });
    window.addEventListener("keydown", markUserInteraction);
    window.addEventListener("pointerdown", markUserInteraction);

    return () => {
      window.removeEventListener("wheel", markUserInteraction);
      window.removeEventListener("touchmove", markUserInteraction);
      window.removeEventListener("keydown", markUserInteraction);
      window.removeEventListener("pointerdown", markUserInteraction);
    };
  }, []);

  const visibleSections = useMemo(() => {
    const sourceResult =
      activeFilter === "saved" && store.saved.length ? store.saved[0] : result;

    return sourceResult.sections.filter((section) =>
      sectionMatchesFilter(section, activeFilter)
    );
  }, [activeFilter, result, store.saved]);

  useEffect(() => {
    const pendingId = pendingAutoScrollIdRef.current;

    if (
      !hasMounted ||
      isPending ||
      !pendingId ||
      pendingId !== result.id ||
      lastAutoScrolledIdRef.current === pendingId ||
      !visibleSections.length ||
      userInteractedDuringGenerationRef.current
    ) {
      return;
    }

    const timeout = window.setTimeout(() => {
      window.requestAnimationFrame(() => {
        outputWorkspaceRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "start"
        });
        lastAutoScrolledIdRef.current = pendingId;
        pendingAutoScrollIdRef.current = "";
      });
    }, 60);

    return () => window.clearTimeout(timeout);
  }, [hasMounted, isPending, result.id, visibleSections.length]);

  const usage = buildUsageSummary(
    plan,
    authenticated ? usageUsed : anonymousUsed,
    initialUsage?.periodEnd
  );
  const hasPaidSelection = selectedTypes.some(isPaidContentType);
  const isPro = plan !== "free";
  const isProStudio = plan === "pro_studio";
  const canGenerate =
    source.trim().length > 7 &&
    selectedTypes.length > 0 &&
    !isPending &&
    usage.remaining > 0 &&
    (isPro || !hasPaidSelection);

  function persistStore(nextStore: StudioStore) {
    setStore(nextStore);
    writeStore(nextStore);
  }

  async function generateContent(nextSource = source) {
    setError("");
    const cleanedSource = cleanPlainText(nextSource);

    if (!isPro && hasPaidSelection) {
      setError("Upgrade to Pro to unlock repurposing, formatter presets, CTAs, carousels, video scripts, email drafts, and saved history.");
      return;
    }

    if (usage.remaining <= 0) {
      setError(
        isPro
          ? "You have used this month's generation allowance."
          : "You have used the free generation limit. Upgrade to Pro to keep generating."
      );
      return;
    }

    isGeneratingRef.current = true;
    userInteractedDuringGenerationRef.current = false;
    setIsPending(true);

    const payload: GenerateRequest = {
      source: cleanedSource,
      brandName,
      audience,
      offer,
      writingStyle,
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

      const cleanedResult = cleanGenerationResult(data);
      pendingAutoScrollIdRef.current = cleanedResult.id;
      setResult(cleanedResult);
      persistStore(addRecent(readStore(), cleanedResult));
      if (authenticated) {
        setUsageUsed((current) => current + 1);
      } else {
        setAnonymousUsed(monthlyStoredGenerationCount(addRecent(readStore(), cleanedResult)));
      }
    } catch (generationError) {
      setError(
        generationError instanceof Error
          ? generationError.message
          : "Generation failed. Try again."
      );
    } finally {
      isGeneratingRef.current = false;
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
      source: cleanPlainText(source),
      tone,
      sharpness,
      ctaMode,
      presetTopic,
      selectedTypes
    };

    persistStore(upsertDraft(readStore(), draft));
  }

  function loadDraft(draft: Draft) {
    setSource(cleanPlainText(draft.source));
    setTone(draft.tone);
    setSharpness(draft.sharpness ?? "balanced");
    setCtaMode(draft.ctaMode ?? "soft");
    setPresetTopic(draft.presetTopic ?? "none");
    setSelectedTypes(draft.selectedTypes);
    setHistoryOpen(false);
  }

  function saveCurrent() {
    if (!isPro) {
      setError("Saved history is a Pro feature.");
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
    try {
      setError("");
      await copyPlainText(buildSectionCopyText(section, { sourceText: result.source }));
      setCopiedId(section.id);
      window.setTimeout(() => setCopiedId(""), 1400);
    } catch (copyError) {
      setError(
        copyError instanceof Error
          ? copyError.message
          : "Unable to copy clean text."
      );
    }
  }

  async function generateImage(section = imageSection) {
    if (!section) {
      return;
    }

    if (!isProStudio) {
      setImageError("Image generation is available on Pro Studio.");
      return;
    }

    setImagePending(true);
    setImageError("");

    const outputText = buildSectionCopyText(section, { sourceText: result.source });

    try {
      const response = await fetch("/api/generate-image", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          outputText,
          platform: section.platform,
          contentType: labelForContentType(section.type),
          style: imageStyle,
          format: imageFormat,
          brandContext: {
            brandName,
            audience,
            offer,
            writingStyle,
            contentGoal,
            brandColors: imageBrandColors,
            visualStyle: imageVisualStyle,
            contentTopic: `${section.title} ${labelForContentType(section.type)}`
          }
        })
      });
      const data = (await response.json()) as {
        image?: string;
        mimeType?: string;
        size?: string;
        style?: ImageStyle;
        format?: ImageFormat;
        template?: string;
        imageCreditsLimit?: number;
        warning?: string;
        createdAt?: string;
        error?: string;
      };

      if (!response.ok || !data.image) {
        throw new Error(data.error ?? "Image generation failed. Try again.");
      }

      const generatedImage = data.image;

      setGeneratedImages((current) => ({
        ...current,
        [section.id]: {
          image: generatedImage,
          mimeType: data.mimeType,
          size: data.size ?? "",
          style: data.style ?? imageStyle,
          format: data.format ?? imageFormat,
          template: data.template,
          warning: data.warning,
          createdAt: data.createdAt ?? new Date().toISOString()
        }
      }));
    } catch (imageGenerationError) {
      setImageError(
        imageGenerationError instanceof Error
          ? imageGenerationError.message
          : "Image generation failed. Try again."
      );
    } finally {
      setImagePending(false);
    }
  }

  return (
    <main className="min-h-screen w-full overflow-x-hidden pb-28 text-bone lg:pb-0">
      <div className="pointer-events-none fixed inset-0 opacity-80">
        <div className="absolute right-[-5rem] top-12 h-72 w-72 rounded-full bg-violet/20 blur-3xl" />
        <div className="absolute bottom-28 left-[-6rem] h-64 w-64 rounded-full bg-gold/10 blur-3xl" />
      </div>

      <TopBar
        authenticated={authenticated}
        menuOpen={menuOpen}
        plan={plan}
        onToggleMenu={() => setMenuOpen((value) => !value)}
      />

      <div className="relative mx-auto block w-full max-w-none min-w-0 space-y-4 px-3 pb-6 pt-4 sm:px-5 lg:grid lg:max-w-[96rem] lg:grid-cols-[4.5rem_minmax(0,1fr)_19rem] lg:gap-4 lg:space-y-0 lg:px-6 lg:pt-6 xl:max-w-[104rem] xl:grid-cols-[5rem_minmax(0,1fr)_21rem] 2xl:max-w-[112rem] 2xl:grid-cols-[5rem_minmax(0,1fr)_22rem] 2xl:gap-5">
        <DesktopRail onNavigate={handleRailAction} />

        <div className="w-full min-w-0 overflow-hidden space-y-4">
          <section className="block w-full min-w-0 space-y-4 2xl:grid 2xl:grid-cols-[minmax(24rem,0.9fr)_minmax(32rem,1.1fr)] 2xl:gap-4 2xl:space-y-0">
            <ComposerPanel
              id="composer"
              source={source}
              tone={tone}
              lastUsedTone={lastUsedTone}
              sharpness={sharpness}
              ctaMode={ctaMode}
              presetTopic={presetTopic}
              selectedTypes={selectedTypes}
              brandName={brandName}
              audience={audience}
              offer={offer}
              writingStyle={writingStyle}
              contentGoal={contentGoal}
              plan={plan}
              usage={usage}
              canGenerate={canGenerate}
              isPending={isPending}
              onSourceChange={setSource}
              onBrandNameChange={setBrandName}
              onAudienceChange={setAudience}
              onOfferChange={setOffer}
              onWritingStyleChange={setWritingStyle}
              onContentGoalChange={setContentGoal}
              onToneChange={(value) => {
                setTone(value);
                setLastUsedTone(value);
                if (hasMounted) {
                  window.localStorage.setItem(LAST_USED_TONE_KEY, value);
                }
              }}
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
              containerRef={outputWorkspaceRef}
              result={result}
              sourceText={result.source}
              activeFilter={activeFilter}
              visibleSections={visibleSections}
              error={error}
              copiedId={copiedId}
              isPending={isPending}
              plan={plan}
              generatedImages={generatedImages}
              onFilterChange={setActiveFilter}
              onCopySection={copySection}
              onOpenImagePanel={(section) => {
                setImageSection(section);
                setImageError("");
              }}
              onRegenerate={() => generateContent()}
              onSaveCurrent={saveCurrent}
              onCopyRefinement={async (section, action) => {
                try {
                  setError("");
                  const sectionText = buildSectionCopyText(section, { sourceText: result.source });
                  await copyPlainText(refineText(sectionText, action));
                  setCopiedId(`${section.id}-${action}`);
                  window.setTimeout(() => setCopiedId(""), 1400);
                } catch (copyError) {
                  setError(
                    copyError instanceof Error
                      ? copyError.message
                      : "Unable to copy clean text."
                  );
                }
              }}
              onCopyAll={async () => {
                try {
                  setError("");
                  await copyPlainText(buildGenerationCopyText(result));
                  setCopiedId("all");
                  window.setTimeout(() => setCopiedId(""), 1400);
                } catch (copyError) {
                  setError(
                    copyError instanceof Error
                      ? copyError.message
                      : "Unable to copy clean text."
                  );
                }
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
              try {
                setError("");
                await copyPlainText(buildGenerationCopyText(item));
                setCopiedId(item.id);
                window.setTimeout(() => setCopiedId(""), 1400);
              } catch (copyError) {
                setError(
                  copyError instanceof Error
                    ? copyError.message
                    : "Unable to copy clean saved content."
                );
              }
            }}
            onDelete={deleteSaved}
            copiedId={copiedId}
          />
        </div>

        <HistoryPanel
          store={store}
          current={result}
          plan={plan}
          usage={usage}
          renderTimestamps={hasMounted}
          isOpen={historyOpen}
          onClose={() => {
            setHistoryOpen(false);
            setMenuOpen(false);
          }}
          onLoadResult={(item) => {
            const cleanedItem = cleanGenerationResult(item);
            setResult(cleanedItem);
            setSource(cleanPlainText(cleanedItem.source));
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

      <ImageGenerationPanel
        section={imageSection}
        plan={plan}
        style={imageStyle}
        format={imageFormat}
        brandColors={imageBrandColors}
        visualStyle={imageVisualStyle}
        image={imageSection ? generatedImages[imageSection.id] : undefined}
        isPending={imagePending}
        error={imageError}
        onClose={() => {
          setImageSection(null);
          setImageError("");
        }}
        onStyleChange={setImageStyle}
        onFormatChange={setImageFormat}
        onBrandColorsChange={setImageBrandColors}
        onVisualStyleChange={setImageVisualStyle}
        onGenerate={() => generateImage()}
      />

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
  authenticated,
  menuOpen,
  plan,
  onToggleMenu
}: {
  authenticated: boolean;
  menuOpen: boolean;
  plan: PlanId;
  onToggleMenu: () => void;
}) {
  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-ink/86 backdrop-blur-xl">
      <div className="mx-auto flex min-h-16 max-w-none items-center justify-between gap-2 px-3 py-3 sm:max-w-7xl sm:gap-3 sm:px-5 lg:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <Link href="/" aria-label="Back to ContentOS homepage" className="hidden lg:block">
            <BrandLogo />
          </Link>
          <Link
            href="/"
            aria-label="Back to ContentOS homepage"
            className="flex min-w-0 items-center gap-2 lg:hidden"
          >
            <BrandLogo size="sm" showWordmark={false} />
            <span className="truncate text-base font-extrabold tracking-normal text-bone">
              Content<span className="text-goldSoft">OS</span>
            </span>
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
            {plan === "pro_studio"
              ? "Pro Studio workspace"
              : plan === "founder"
                ? "Founder workspace"
              : plan === "pro_creator"
                ? "Pro Creator workspace"
                : "Free workspace"}
          </div>
          {authenticated ? (
            <>
              <Link
                href="/dashboard"
                className="flex min-h-10 items-center rounded border border-white/10 bg-white/[0.04] px-3 text-xs font-semibold text-bone transition hover:border-gold/60"
              >
                Account
              </Link>
              <LogoutButton className="flex min-h-10 items-center rounded border border-white/10 bg-white/[0.04] px-3 text-xs font-semibold text-bone transition hover:border-gold/60 disabled:text-muted" />
            </>
          ) : (
            <Link
              href="/login"
              className="flex min-h-10 items-center rounded border border-white/10 bg-white/[0.04] px-3 text-xs font-semibold text-bone transition hover:border-gold/60"
            >
              Log in
            </Link>
          )}
        </div>

        <div className="relative z-[90] flex shrink-0 items-center lg:hidden">
          <button
            type="button"
            onClick={onToggleMenu}
            className="grid h-10 w-10 place-items-center rounded-lg border border-white/10 bg-white/[0.04] text-muted"
            aria-label={menuOpen ? "Close account menu" : "Open account menu"}
            aria-expanded={menuOpen}
          >
            {menuOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
          {menuOpen ? (
            <div className="absolute right-0 top-full z-[100] mt-2 w-[11.25rem] rounded-xl border border-white/10 bg-[#07050d] p-1.5 shadow-[0_18px_45px_rgba(0,0,0,0.55)]">
              {authenticated ? (
                <>
                  <Link
                    href="/dashboard#account"
                    className="flex h-9 w-full items-center justify-start rounded-lg px-3 text-[0.82rem] font-semibold leading-none text-bone transition hover:bg-white/[0.06]"
                  >
                    Account
                  </Link>
                  <Link
                    href="/dashboard"
                    className="flex h-9 w-full items-center justify-start rounded-lg px-3 text-[0.82rem] font-semibold leading-none text-bone transition hover:bg-white/[0.06]"
                  >
                    Dashboard
                  </Link>
                  <LogoutButton className="flex h-9 w-full items-center justify-start rounded-lg px-3 text-left text-[0.82rem] font-semibold leading-none text-bone transition hover:bg-white/[0.06] disabled:text-muted" />
                </>
              ) : (
                <Link
                  href="/login"
                  className="flex h-9 w-full items-center justify-start rounded-lg px-3 text-[0.82rem] font-semibold leading-none text-bone transition hover:bg-white/[0.06]"
                >
                  Log in
                </Link>
              )}
            </div>
          ) : null}
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
  lastUsedTone,
  sharpness,
  ctaMode,
  presetTopic,
  selectedTypes,
  brandName,
  audience,
  offer,
  writingStyle,
  contentGoal,
  plan,
  usage,
  canGenerate,
  isPending,
  onSourceChange,
  onBrandNameChange,
  onAudienceChange,
  onOfferChange,
  onWritingStyleChange,
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
  lastUsedTone: ToneId | null;
  sharpness: SharpnessId;
  ctaMode: CtaModeId;
  presetTopic: PresetTopicId;
  selectedTypes: ContentTypeId[];
  brandName: string;
  audience: string;
  offer: string;
  writingStyle: string;
  contentGoal: string;
  plan: PlanId;
  usage: UsageSummary;
  canGenerate: boolean;
  isPending: boolean;
  onSourceChange: (value: string) => void;
  onBrandNameChange: (value: string) => void;
  onAudienceChange: (value: string) => void;
  onOfferChange: (value: string) => void;
  onWritingStyleChange: (value: string) => void;
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
  const isPro = plan !== "free";

  return (
    <section
      id={id}
      className="scroll-mt-20 w-full min-w-0 rounded-2xl border border-white/10 bg-panel/82 p-4 shadow-violet backdrop-blur-xl sm:rounded sm:border sm:p-5"
    >
      <div className="mb-5 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="font-display text-[2rem] uppercase leading-none tracking-normal text-bone sm:text-4xl">
            ContentOS
          </h1>
          <p className="mt-3 max-w-none text-[0.95rem] leading-7 text-muted sm:max-w-sm sm:text-sm sm:leading-6">
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

      <div className="mb-5 rounded-xl border border-white/[0.08] bg-white/[0.045] p-4 sm:rounded sm:p-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-base font-semibold text-bone sm:text-sm">
              {isPro
                ? `${usage.used} of ${usage.limit} monthly generations used`
                : `${usage.used} of ${usage.limit} free generations used`}
            </p>
            <p className="mt-1 text-sm leading-6 text-muted sm:text-xs sm:leading-5">
              {isPro
                ? `${usage.remaining} monthly generations remaining.`
                : `${usage.remaining} free generations remaining. Pro unlocks full generation, formatter presets, repurposing, and saved history.`}
            </p>
          </div>
          <div className="grid w-full grid-cols-3 overflow-hidden rounded-lg border border-white/10 bg-ink/70 sm:w-64 sm:rounded">
            <button
              type="button"
              onClick={() => onPlanChange("free")}
              className={clsx(
                "min-h-11 px-3 text-sm font-semibold sm:min-h-10 sm:text-xs",
                !isPro ? "bg-gold/10 text-bone" : "text-muted hover:text-bone"
              )}
            >
              Free
            </button>
            <button
              type="button"
              onClick={() => onPlanChange("pro_creator")}
              className={clsx(
                "min-h-11 border-l border-white/10 px-3 text-sm font-semibold sm:min-h-10 sm:text-xs",
                plan === "pro_creator" ? "bg-violet/25 text-bone" : "text-muted hover:text-bone"
              )}
            >
              Creator
            </button>
            <button
              type="button"
              onClick={() => onPlanChange("pro_studio")}
              className={clsx(
                "min-h-11 border-l border-white/10 px-3 text-sm font-semibold sm:min-h-10 sm:text-xs",
                plan === "pro_studio" ? "bg-violet/25 text-bone" : "text-muted hover:text-bone"
              )}
            >
              Studio
            </button>
          </div>
        </div>
      </div>

      <label className="text-[0.72rem] font-semibold uppercase tracking-[0.14em] text-goldSoft sm:text-xs sm:tracking-[0.18em]">
        Source material
      </label>
      <textarea
        value={source}
        onChange={(event) => onSourceChange(event.target.value)}
        rows={10}
        className="studio-scroll mt-3 min-h-56 w-full resize-none rounded-xl border border-line bg-ink/90 p-4 text-[0.95rem] leading-7 text-bone outline-none transition placeholder:text-muted/60 focus:border-violet/70 focus:ring-2 focus:ring-violet/20 sm:min-h-60 sm:rounded sm:text-base"
        placeholder="Paste notes, a customer insight, a launch idea, an offer, or the messy thought you want to turn into content."
      />

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {[
          { label: "Brand/business name", value: brandName, onChange: onBrandNameChange, placeholder: "Acme Studio" },
          { label: "Target audience", value: audience, onChange: onAudienceChange, placeholder: "Busy founders and consultants" },
          { label: "Offer/product/service", value: offer, onChange: onOfferChange, placeholder: "Content planning service" },
          { label: "Content goal", value: contentGoal, onChange: onContentGoalChange, placeholder: "Generate qualified leads" }
        ].map((item) => (
          <label key={item.label} className="grid gap-2 text-[0.72rem] font-semibold uppercase tracking-[0.14em] text-goldSoft sm:text-xs sm:tracking-[0.18em]">
            {item.label}
            <input
              value={item.value}
              onChange={(event) => item.onChange(event.target.value)}
              placeholder={item.placeholder}
              className="min-h-12 rounded-xl border border-line bg-ink/90 px-4 text-[0.95rem] normal-case tracking-normal text-bone outline-none transition placeholder:text-muted/60 focus:border-violet/70 focus:ring-2 focus:ring-violet/20 sm:min-h-11 sm:rounded sm:px-3 sm:text-sm"
            />
          </label>
        ))}
      </div>

      <label className="mt-4 grid gap-2 text-[0.72rem] font-semibold uppercase tracking-[0.14em] text-goldSoft sm:text-xs sm:tracking-[0.18em]">
        Writing style
        <textarea
          value={writingStyle}
          onChange={(event) => onWritingStyleChange(event.target.value)}
          rows={3}
          placeholder="Confident, useful, concise, practical, lightly witty."
          className="studio-scroll rounded-xl border border-line bg-ink/90 p-4 text-[0.95rem] normal-case leading-7 tracking-normal text-bone outline-none transition placeholder:text-muted/60 focus:border-violet/70 focus:ring-2 focus:ring-violet/20 sm:rounded sm:p-3 sm:text-sm sm:leading-6"
        />
      </label>

      <div className="mt-5 grid gap-3 sm:mt-4 sm:grid-cols-2 sm:gap-2">
        <button
          type="button"
          onClick={onGenerate}
          disabled={!canGenerate}
          className="flex min-h-14 items-center justify-center gap-2 rounded-xl border border-violet/70 bg-violet px-4 text-base font-semibold text-white shadow-violet transition hover:bg-violetDeep disabled:cursor-not-allowed disabled:border-white/10 disabled:bg-white/10 disabled:text-muted sm:min-h-12 sm:rounded sm:text-sm"
        >
          {isPending ? <Loader2 className="animate-spin" size={18} /> : <Wand2 size={18} />}
          Generate
        </button>
        <button
          type="button"
          onClick={onSaveDraft}
          className="flex min-h-12 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.035] px-4 text-sm font-semibold text-bone transition hover:border-gold/60 sm:rounded"
        >
          <Save size={17} />
          Save draft
        </button>
      </div>

      <div className="mt-6 sm:mt-5">
        <div className="mb-2 flex items-center justify-between gap-3">
          <label
            htmlFor="preset-topic"
            className="text-[0.72rem] font-semibold uppercase tracking-[0.14em] text-goldSoft sm:text-xs sm:tracking-[0.18em]"
          >
            Topic
          </label>
          <p className="truncate text-xs text-muted">{labelForPresetTopic(presetTopic)}</p>
        </div>
        <select
          id="preset-topic"
          value={presetTopic}
          onChange={(event) => onPresetTopicChange(event.target.value as PresetTopicId)}
          className="min-h-12 w-full rounded-xl border border-line bg-ink/90 px-4 text-[0.95rem] font-semibold text-bone outline-none transition focus:border-violet/70 focus:ring-2 focus:ring-violet/20 sm:rounded sm:px-3 sm:text-sm"
        >
          {presetTopics.map((topic) => (
            <option key={topic.id} value={topic.id} className="bg-ink text-bone">
              {topic.label}
            </option>
          ))}
        </select>
      </div>

      <div className="mt-6 sm:mt-5">
        <p className="mb-2 text-[0.72rem] font-semibold uppercase tracking-[0.14em] text-goldSoft sm:text-xs sm:tracking-[0.18em]">
          Content types
        </p>
        <div className="studio-scroll flex snap-x gap-2 overflow-x-auto pb-2 sm:flex-wrap sm:overflow-visible">
          {contentTypes.map((item) => {
            const active = selectedTypes.includes(item.id);
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onToggleType(item.id)}
                title={item.paidOnly && !isPro ? "Pro output" : item.label}
                className={clsx(
                  "flex min-h-11 shrink-0 snap-start items-center gap-2 rounded-full border px-4 text-sm transition sm:min-h-10 sm:shrink sm:rounded sm:px-3",
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

      <div className="mt-6 sm:mt-5">
        <div className="mb-2 flex items-center justify-between gap-3">
          <p className="text-[0.72rem] font-semibold uppercase tracking-[0.14em] text-goldSoft sm:text-xs sm:tracking-[0.18em]">
            Tone
          </p>
          <p className="text-xs text-muted">{labelForTone(tone)}</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 sm:gap-2">
          {tones.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => onToneChange(item.id)}
              className={clsx(
                "rounded-xl border p-3 text-left transition sm:rounded sm:p-3",
                tone === item.id
                  ? "border-gold/70 bg-gold/10 text-bone"
                  : "border-white/10 bg-white/[0.035] text-muted hover:border-violet/60"
              )}
            >
              <span className="flex items-center justify-between gap-2 text-[0.95rem] font-semibold text-bone sm:text-sm">
                {item.label}
                {lastUsedTone === item.id ? (
                  <span className="rounded-full border border-gold/40 bg-gold/10 px-2 py-0.5 text-[0.62rem] uppercase tracking-[0.12em] text-goldSoft">
                    Last used
                  </span>
                ) : null}
              </span>
              <span className="mt-1 block text-xs leading-5">{item.description}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="mt-6 sm:mt-5">
        <div className="mb-2 flex items-center justify-between gap-3">
          <p className="text-[0.72rem] font-semibold uppercase tracking-[0.14em] text-goldSoft sm:text-xs sm:tracking-[0.18em]">
            Sharpness
          </p>
          <p className="text-xs text-muted">{labelForSharpness(sharpness)}</p>
        </div>
        <div className="grid grid-cols-2 overflow-hidden rounded-xl border border-white/10 bg-white/[0.03] sm:rounded sm:grid-cols-4">
          {sharpnessModes.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => onSharpnessChange(item.id)}
              title={item.description}
              className={clsx(
                "min-h-12 border-r border-white/10 px-2 text-sm font-semibold transition last:border-r-0 sm:min-h-11 sm:text-xs",
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

      <div className="mt-6 sm:mt-5">
        <div className="mb-2 flex items-center justify-between gap-3">
          <p className="text-[0.72rem] font-semibold uppercase tracking-[0.14em] text-goldSoft sm:text-xs sm:tracking-[0.18em]">
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
                "min-h-11 shrink-0 rounded-full border px-4 text-sm transition sm:min-h-10 sm:rounded sm:px-3",
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
    </section>
  );
}

function OutputPanel({
  id,
  containerRef,
  result,
  sourceText,
  activeFilter,
  visibleSections,
  error,
  copiedId,
  isPending,
  isSaved,
  plan,
  generatedImages,
  onFilterChange,
  onCopySection,
  onOpenImagePanel,
  onRegenerate,
  onSaveCurrent,
  onCopyRefinement,
  onCopyAll,
  onDownload
}: {
  id: string;
  containerRef: React.RefObject<HTMLElement | null>;
  result: GenerationResult;
  sourceText: string;
  activeFilter: FilterId;
  visibleSections: GeneratedSection[];
  error: string;
  copiedId: string;
  isPending: boolean;
  isSaved: boolean;
  plan: PlanId;
  generatedImages: Record<string, GeneratedImage>;
  onFilterChange: (value: FilterId) => void;
  onCopySection: (section: GeneratedSection) => void;
  onOpenImagePanel: (section: GeneratedSection) => void;
  onRegenerate: () => void;
  onSaveCurrent: () => void;
  onCopyRefinement: (section: GeneratedSection, action: string) => void;
  onCopyAll: () => void;
  onDownload: () => void;
}) {
  return (
    <section
      id={id}
      ref={containerRef}
      className="scroll-mt-20 w-full min-w-0 overflow-hidden rounded-2xl border border-white/10 bg-coal/88 p-4 backdrop-blur-xl sm:rounded sm:border sm:p-5"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 overflow-hidden">
          <p className="text-[0.72rem] font-semibold uppercase tracking-[0.14em] text-goldSoft sm:text-xs sm:tracking-[0.18em]">
            Output workspace
          </p>
          <h2 className="mt-2 line-clamp-2 font-display text-[1.7rem] uppercase leading-none tracking-normal text-bone sm:truncate sm:text-2xl">
            {result.title}
          </h2>
          <p className="mt-3 break-words text-sm leading-6 text-muted sm:mt-2">{result.summary}</p>
        </div>
        <button
          type="button"
          onClick={onSaveCurrent}
          className={clsx(
            "grid h-11 w-11 shrink-0 place-items-center rounded-xl border transition sm:rounded",
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

      {!isPending && result.id !== "sample" && result.sections.length ? (
        <GenerationSummary sections={result.sections} />
      ) : null}

      <div className="studio-scroll mt-5 flex snap-x scroll-px-4 gap-2 overflow-x-auto pb-2 sm:mt-4">
        {filters.map((filter) => (
          <button
            key={filter.id}
            type="button"
            onClick={() => onFilterChange(filter.id)}
            className={clsx(
              "min-h-11 shrink-0 rounded-full border px-4 text-sm transition sm:min-h-10 sm:rounded sm:px-3",
              activeFilter === filter.id
                ? "border-gold/70 bg-gold/10 text-bone"
                : "border-white/10 bg-white/[0.035] text-muted hover:border-violet/50"
            )}
          >
            {filter.label}
          </button>
        ))}
      </div>

      <div className="mt-4 grid w-full min-w-0 gap-4 sm:mt-3 sm:gap-3">
        {isPending ? (
          <LoadingCard />
        ) : visibleSections.length ? (
          visibleSections.map((section) => (
            <OutputCard
              key={section.id}
              section={section}
              sourceText={sourceText}
              copied={copiedId === section.id}
              plan={plan}
              image={generatedImages[section.id]}
              onCopy={() => onCopySection(section)}
              onGenerateImage={() => onOpenImagePanel(section)}
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
          className="mt-5 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.035] px-4 text-sm font-semibold text-bone transition hover:border-violet/60 disabled:cursor-not-allowed disabled:text-muted sm:mt-4 sm:min-h-11 sm:rounded"
      >
        <RefreshCcw size={17} />
        Regenerate current set
      </button>
      <div className="mt-3 grid gap-2 sm:mt-2 sm:grid-cols-3">
        <button
          type="button"
          onClick={onCopyAll}
          className="flex min-h-11 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.035] px-4 text-sm font-semibold text-bone transition hover:border-violet/60 sm:rounded"
        >
          <Copy size={16} />
          {copiedId === "all" ? "Copied" : "Copy all"}
        </button>
        <button
          type="button"
          onClick={onDownload}
          className="flex min-h-11 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.035] px-4 text-sm font-semibold text-bone transition hover:border-violet/60 sm:rounded"
        >
          <FileText size={16} />
          Download .txt
        </button>
        <button
          type="button"
          onClick={onSaveCurrent}
          className="flex min-h-11 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.035] px-4 text-sm font-semibold text-bone transition hover:border-gold/60 sm:rounded"
        >
          <Bookmark size={16} />
          Save all
        </button>
      </div>
    </section>
  );
}

function GenerationSummary({ sections }: { sections: GeneratedSection[] }) {
  const labels = Array.from(new Set(sections.map((section) => labelForContentType(section.type))));

  return (
    <div className="mt-4 rounded-xl border border-violet/30 bg-violet/[0.08] p-3 sm:rounded">
      <p className="text-sm font-semibold text-bone">Generated from 1 idea:</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {labels.map((label) => (
          <span
            key={label}
            className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-ink/60 px-3 py-1.5 text-xs font-semibold text-bone"
          >
            <Check size={13} className="text-goldSoft" />
            {label}
          </span>
        ))}
      </div>
    </div>
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
  const [text, setText] = useState(cleanPlainText(formatterStarterText));
  const [previewMode, setPreviewMode] = useState<FormatterMode>("desktop");
  const [platform, setPlatform] = useState<FormatterPlatform>("linkedin");
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const isPro = plan !== "free";
  const activePlatform = formatterPlatforms.find((item) => item.id === platform) ?? formatterPlatforms[0];
  const formattedText = formatFormatterPlainText(text);

  function replaceSelection(transform: (value: string) => string) {
    const textarea = textareaRef.current;
    if (!textarea) {
      setText((current) => cleanPlainText(transform(current)));
      return;
    }

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const hasSelection = start !== end;
    const targetText = hasSelection ? text.slice(start, end) : text;
    const replacement = cleanPlainText(transform(targetText));
    const nextText = hasSelection
      ? `${text.slice(0, start)}${replacement}${text.slice(end)}`
      : replacement;

    setText(cleanPlainText(nextText));
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
      onPlanChange("pro_creator");
      return;
    }

    try {
      setCopyError("");
      await copyPlainText(formattedText);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    } catch (formatterCopyError) {
      setCopied(false);
      setCopyError(
        formatterCopyError instanceof Error
          ? formatterCopyError.message
          : "Unable to copy clean formatted text."
      );
    }
  }

  function downloadFormattedText() {
    if (!isPro) {
      onPlanChange("pro_creator");
      return;
    }

    const blob = new Blob([formattedText], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = `contentos-${platform}-formatted.txt`;
    link.click();
    URL.revokeObjectURL(url);
  }

  function applyPlatformTemplate(nextPlatform: FormatterPlatform) {
    setPlatform(nextPlatform);

    if (!isPro) {
      return;
    }

    if (nextPlatform === "xThread") {
      setText((current) =>
        cleanPlainText(current)
          .split(/\n{2,}/)
          .filter(Boolean)
          .map((line, index) => `${index + 1}. ${line.replace(/^\d+\.\s*/, "")}`)
          .join("\n\n")
      );
    }

    if (nextPlatform === "shortVideoScript") {
      setText((current) => cleanPlainText(`Hook:\n${cleanPlainText(current).split("\n")[0] ?? ""}\n\nBeat 1:\n\nBeat 2:\n\nOn-screen text:\n\nClose:`));
    }
  }

  return (
    <section
      id={id}
      className="scroll-mt-20 w-full min-w-0 rounded-2xl border border-white/10 bg-panel/82 p-4 shadow-violet backdrop-blur-xl sm:rounded sm:border sm:p-5"
    >
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-[0.72rem] font-semibold uppercase tracking-[0.14em] text-goldSoft sm:text-xs sm:tracking-[0.18em]">
            Platform formatter
          </p>
          <h2 className="mt-2 font-display text-[1.7rem] uppercase leading-none tracking-normal text-bone sm:text-2xl">
            Format Platform Text
          </h2>
          <p className="mt-2 max-w-xl text-sm leading-6 text-muted">
            Format LinkedIn posts, Instagram captions, TikTok captions, X threads, and short-form video scripts.
          </p>
        </div>

        <div className="grid w-full grid-cols-2 overflow-hidden rounded-xl border border-white/10 bg-white/[0.03] sm:w-48 sm:rounded">
          <button
            type="button"
            onClick={() => setPreviewMode("desktop")}
            className={clsx(
              "flex min-h-11 items-center justify-center gap-2 border-r border-white/10 px-3 text-xs font-semibold sm:min-h-10",
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
              "flex min-h-11 items-center justify-center gap-2 px-3 text-xs font-semibold sm:min-h-10",
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

      <div className="grid gap-4 2xl:grid-cols-[minmax(28rem,0.95fr)_minmax(34rem,1.05fr)]">
        <div className="min-w-0">
          <div className="studio-scroll mb-3 flex gap-2 overflow-x-auto pb-1">
            {formatterPlatforms.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => applyPlatformTemplate(item.id)}
                className={clsx(
                  "min-h-11 shrink-0 rounded-full border px-4 text-sm font-semibold transition sm:min-h-10 sm:rounded sm:px-3",
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
            className="studio-scroll min-h-80 w-full resize-none rounded-xl border border-line bg-ink/90 p-4 text-[0.95rem] leading-7 text-bone outline-none transition placeholder:text-muted/60 focus:border-violet/70 focus:ring-2 focus:ring-violet/20 sm:rounded sm:p-4 sm:text-base"
            placeholder="Write or paste platform copy here."
          />

          <div className="mt-3 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <p className="shrink-0 text-xs leading-5 text-muted">
              {formattedText.length.toLocaleString()} characters
            </p>
            <div className="grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-3 lg:flex lg:flex-wrap lg:justify-end">
              <button
                type="button"
                onClick={() => setText("")}
                className="flex min-h-11 min-w-0 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.035] px-4 text-sm font-semibold text-bone transition hover:border-violet/60 sm:rounded lg:min-w-[7rem]"
              >
                <Eraser size={16} />
                Clear
              </button>
              <button
                type="button"
                onClick={downloadFormattedText}
                className="flex min-h-11 min-w-0 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.035] px-4 text-sm font-semibold text-bone transition hover:border-gold/60 sm:rounded lg:min-w-[8rem]"
              >
                <FileText size={16} />
                Download
              </button>
              <button
                type="button"
                onClick={copyFormattedText}
                className="flex min-h-11 min-w-0 items-center justify-center gap-2 rounded-xl border border-violet/70 bg-violet px-4 text-sm font-semibold text-white shadow-violet transition hover:bg-violetDeep sm:rounded lg:min-w-[7rem]"
              >
                {copied ? <Check size={16} /> : <Copy size={16} />}
                {isPro ? (copied ? "Copied" : "Copy") : "Unlock"}
              </button>
            </div>
          </div>
          {copyError ? (
            <p className="mt-2 text-xs leading-5 text-goldSoft">{copyError}</p>
          ) : null}
        </div>

        <div
          className={clsx(
            "min-w-0 rounded-xl border border-white/10 bg-ink/90 p-3 sm:rounded sm:p-4",
            previewMode === "mobile" ? "mx-auto w-full max-w-none sm:max-w-sm" : "w-full 2xl:min-w-[34rem]"
          )}
        >
          <div className="mx-auto w-full max-w-[40rem] rounded bg-[#f4f2ee] p-4 text-[#191919] 2xl:max-w-none">
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
              {formattedText || "Your formatted platform preview will appear here."}
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
  sourceText,
  copied,
  plan,
  image,
  onCopy,
  onGenerateImage,
  onCopyRefinement
}: {
  section: GeneratedSection;
  sourceText: string;
  copied: boolean;
  plan: PlanId;
  image?: GeneratedImage;
  onCopy: () => void;
  onGenerateImage: () => void;
  onCopyRefinement: (action: string) => void;
}) {
  const canGenerateImage = plan === "pro_studio";
  const formattedOutput = formatOutputSection(section, sourceText);

  return (
    <article className="w-full min-w-0 overflow-hidden rounded-2xl border border-white/[0.08] bg-ink/58 p-4 shadow-[0_16px_45px_rgba(0,0,0,0.22)] sm:rounded sm:border-white/10 sm:bg-white/[0.035] sm:p-4 sm:shadow-none">
      <div className="mb-4 flex flex-col gap-3 sm:mb-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 overflow-hidden">
          <p className="text-[0.72rem] uppercase tracking-[0.14em] text-violet sm:text-xs sm:tracking-[0.18em]">
            {section.platform}
          </p>
          <h3 className="mt-2 break-words text-xl font-semibold leading-6 text-bone sm:mt-1 sm:text-lg">{section.title}</h3>
          <p className="mt-2 text-xs text-muted sm:mt-1">{labelForContentType(section.type)}</p>
        </div>
        <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:shrink-0 sm:flex-wrap">
          <button
            type="button"
            onClick={onGenerateImage}
            className={clsx(
              "flex min-h-11 items-center justify-center gap-2 rounded-xl border px-3 text-xs font-semibold transition sm:min-h-10 sm:rounded",
              canGenerateImage
                ? "border-gold/60 bg-gold/10 text-bone hover:border-gold"
                : "border-white/10 bg-ink/70 text-muted hover:border-gold/60 hover:text-bone"
            )}
          >
            {canGenerateImage ? <Wand2 size={15} /> : <Lock size={15} />}
            Generate Image
          </button>
          <button
            type="button"
            onClick={onCopy}
            className="flex min-h-11 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 text-xs font-semibold text-bone transition hover:border-violet/60 sm:min-h-10 sm:rounded sm:bg-ink/70"
          >
            {copied ? <Check size={15} /> : <Copy size={15} />}
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
      </div>

      <PlatformOutputBlocks blocks={formattedOutput.blocks} />

      {image ? (
        <div className="mt-4 rounded-xl border border-gold/30 bg-ink/55 p-3 sm:rounded">
          <img
            src={image.image}
            alt={`Generated visual for ${section.title}`}
            className="aspect-square w-full rounded border border-white/10 object-cover"
          />
          <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-muted">
              {image.template ? `${image.template.replace(/_/g, " ")} · ` : ""}
              {image.style} · {image.size || image.format}
            </p>
            <button
              type="button"
              onClick={() => void downloadVisualAsPng(image.image, imageFilename(section.title))}
              className="flex min-h-10 items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-3 text-xs font-semibold text-bone transition hover:border-gold/60 sm:rounded"
            >
              <FileText size={14} />
              Download PNG
            </button>
          </div>
          {image.warning ? (
            <p className="mt-2 text-xs leading-5 text-goldSoft">{image.warning}</p>
          ) : null}
        </div>
      ) : null}

      <div className="studio-scroll mt-5 flex gap-2 overflow-x-auto pb-1 sm:mt-4">
        {[
          "shorten",
          "simplify",
          "improve hook",
          "improve CTA"
        ].map((action) => (
          <button
            key={action}
            type="button"
            onClick={() => onCopyRefinement(action)}
            className="min-h-10 shrink-0 rounded-full border border-white/10 bg-white/[0.035] px-3 text-xs font-semibold text-muted transition hover:border-violet/60 hover:text-bone sm:min-h-9 sm:rounded sm:bg-ink/70"
          >
            {action}
          </button>
        ))}
      </div>
    </article>
  );
}

function PlatformOutputBlocks({ blocks }: { blocks: OutputBlock[] }) {
  if (!blocks.length) {
    return (
      <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 text-sm leading-6 text-muted sm:rounded">
        No readable output content was returned for this card.
      </div>
    );
  }

  return (
    <div className="grid min-w-0 gap-3">
      {blocks.map((block) => (
        <PlatformOutputBlock key={block.id} block={block} />
      ))}
    </div>
  );
}

function PlatformOutputBlock({ block }: { block: OutputBlock }) {
  if (block.kind === "thread") {
    return (
      <div className="grid min-w-0 gap-2">
        <OutputBlockLabel>{block.label}</OutputBlockLabel>
        <ol className="grid min-w-0 gap-2">
          {block.lines.map((line, index) => (
            <li
              key={`${line}-${index}`}
              className="grid min-w-0 grid-cols-[2rem_minmax(0,1fr)] gap-3 rounded-xl border border-white/[0.08] bg-white/[0.035] p-3 text-sm leading-6 text-bone/90 sm:rounded"
            >
              <span className="grid h-7 w-7 place-items-center rounded-full border border-gold/50 bg-gold/10 text-xs font-semibold text-goldSoft">
                {index + 1}
              </span>
              <span className="min-w-0 whitespace-pre-line break-words">{line}</span>
            </li>
          ))}
        </ol>
      </div>
    );
  }

  if (block.kind === "hashtags" || block.kind === "tags") {
    return (
      <div className="min-w-0 rounded-xl border border-gold/25 bg-gold/[0.07] p-3 sm:rounded">
        <OutputBlockLabel>{block.label}</OutputBlockLabel>
        <div className="mt-2 flex flex-wrap gap-2">
          {block.lines.map((line) => (
            <span
              key={line}
              className="max-w-full break-words rounded-full border border-gold/25 bg-ink/60 px-3 py-1.5 text-xs font-semibold text-goldSoft"
            >
              {line}
            </span>
          ))}
        </div>
      </div>
    );
  }

  if (block.kind === "platform") {
    return (
      <div className="min-w-0 rounded-xl border border-white/[0.08] bg-white/[0.035] p-4 sm:rounded">
        <OutputBlockLabel>{block.label}</OutputBlockLabel>
        <div className="mt-3 grid gap-3">
          {block.lines.map((line, index) => (
            <p key={`${line}-${index}`} className="min-w-0 whitespace-pre-line break-words text-sm leading-6 text-bone/92">
              {line}
            </p>
          ))}
        </div>
      </div>
    );
  }

  if (block.kind === "hook" || block.kind === "subject" || block.kind === "title") {
    return (
      <div className="min-w-0 rounded-xl border border-violet/30 bg-violet/10 p-4 text-sm leading-6 text-bone sm:rounded">
        <OutputBlockLabel>{block.label}</OutputBlockLabel>
        <div className="mt-2 grid min-w-0 gap-2">
          {block.lines.map((line) => (
            <p key={line} className="min-w-0 break-words text-[0.98rem] font-semibold leading-7 text-bone">
              {line}
            </p>
          ))}
        </div>
      </div>
    );
  }

  if (block.kind === "cta" || block.kind === "preview") {
    return (
      <div className="min-w-0 rounded-xl border border-violet/35 bg-violet/[0.08] p-4 text-sm leading-6 text-bone sm:rounded sm:p-3">
        <OutputBlockLabel>{block.label}</OutputBlockLabel>
        <div className="mt-2 grid min-w-0 gap-2">
          {block.lines.map((line) => (
            <p key={line} className="min-w-0 whitespace-pre-line break-words text-bone/92">
              {line}
            </p>
          ))}
        </div>
      </div>
    );
  }

  if (block.kind === "items") {
    return (
      <div className="grid min-w-0 gap-2">
        <OutputBlockLabel>{block.label}</OutputBlockLabel>
        <ul className="grid min-w-0 gap-2">
          {block.lines.map((line) => (
            <li
              key={line}
              className="min-w-0 break-words rounded-lg border-l-2 border-gold/70 bg-white/[0.035] py-2.5 pl-3 pr-2 text-sm leading-6 text-muted sm:rounded-none sm:bg-ink/42 sm:py-2 sm:pr-0"
            >
              {line}
            </li>
          ))}
        </ul>
      </div>
    );
  }

  return (
    <div className="grid min-w-0 gap-3">
      <OutputBlockLabel>{block.label}</OutputBlockLabel>
      {block.lines.map((line) => (
        <p key={line} className="min-w-0 whitespace-pre-line break-words text-[0.95rem] leading-7 text-bone/92">
          {line}
        </p>
      ))}
    </div>
  );
}

function OutputBlockLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-goldSoft/90 sm:text-[0.7rem]">
      {children}
    </p>
  );
}

function ImageGenerationPanel({
  section,
  plan,
  style,
  format,
  brandColors,
  visualStyle,
  image,
  isPending,
  error,
  onClose,
  onStyleChange,
  onFormatChange,
  onBrandColorsChange,
  onVisualStyleChange,
  onGenerate
}: {
  section: GeneratedSection | null;
  plan: PlanId;
  style: ImageStyle;
  format: ImageFormat;
  brandColors: string;
  visualStyle: string;
  image?: GeneratedImage;
  isPending: boolean;
  error: string;
  onClose: () => void;
  onStyleChange: (value: ImageStyle) => void;
  onFormatChange: (value: ImageFormat) => void;
  onBrandColorsChange: (value: string) => void;
  onVisualStyleChange: (value: string) => void;
  onGenerate: () => void;
}) {
  if (!section) {
    return null;
  }

  const isProStudio = plan === "pro_studio";

  return (
    <div className="fixed inset-0 z-[70] overflow-y-auto bg-black/70 px-4 py-6 backdrop-blur-sm">
      <div className="mx-auto w-full max-w-2xl rounded border border-white/10 bg-coal p-4 shadow-violet sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-goldSoft">
              Image generation
            </p>
            <h2 className="mt-2 font-display text-2xl uppercase tracking-normal text-bone">
              Generate Visual
            </h2>
            <p className="mt-2 text-sm leading-6 text-muted">
              Create a branded social graphic from this {section.platform} output. Text is rendered separately for cleaner, publication-ready results.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid h-10 w-10 shrink-0 place-items-center rounded border border-white/10 bg-white/[0.04] text-muted transition hover:border-violet/60 hover:text-bone"
            aria-label="Close image generation"
          >
            <X size={18} />
          </button>
        </div>

        {!isProStudio ? (
          <div className="mt-5 rounded border border-gold/30 bg-gold/10 p-4">
            <div className="flex items-start gap-3">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded bg-gold/15 text-goldSoft">
                <Lock size={18} />
              </div>
              <div className="min-w-0">
                <h3 className="font-semibold text-bone">
                  Image generation is available on Pro Studio.
                </h3>
                <p className="mt-2 text-sm leading-6 text-muted">
                  Upgrade to generate branded social graphics with clean app-rendered text from your finished content packs.
                </p>
                <div className="mt-4 max-w-xs">
                  <CheckoutButton plan="pro_studio">Upgrade to Pro Studio</CheckoutButton>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <>
            <div className="mt-5 grid gap-4">
              <div className="rounded border border-gold/30 bg-gold/[0.08] p-3 text-xs leading-5 text-goldSoft">
                AI is used for the background only. ContentOS renders every visible word with controlled typography, wrapping, and safe margins.
              </div>
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-muted">
                  Style
                </p>
                <div className="grid gap-2 sm:grid-cols-3">
                  {imageStyles.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => onStyleChange(item.id)}
                      className={clsx(
                        "min-h-11 rounded border px-3 text-sm font-semibold transition",
                        style === item.id
                          ? "border-gold/70 bg-gold/10 text-bone"
                          : "border-white/10 bg-white/[0.035] text-muted hover:border-violet/60"
                      )}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-muted">
                  Format
                </p>
                <div className="grid gap-2 sm:grid-cols-3">
                  {imageFormats.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => onFormatChange(item.id)}
                      className={clsx(
                        "min-h-14 rounded border px-3 text-left transition",
                        format === item.id
                          ? "border-gold/70 bg-gold/10 text-bone"
                          : "border-white/10 bg-white/[0.035] text-muted hover:border-violet/60"
                      )}
                    >
                      <span className="block text-sm font-semibold">{item.label}</span>
                      <span className="mt-1 block text-xs text-muted">{item.helper}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="grid gap-2">
                  <span className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">
                    Brand colours
                  </span>
                  <input
                    value={brandColors}
                    onChange={(event) => onBrandColorsChange(event.target.value)}
                    className="min-h-11 rounded border border-white/10 bg-ink/70 px-3 text-sm text-bone outline-none transition placeholder:text-muted focus:border-violet/70"
                    placeholder="Deep black, violet, gold, off-white"
                  />
                </label>
                <label className="grid gap-2">
                  <span className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">
                    Visual direction
                  </span>
                  <input
                    value={visualStyle}
                    onChange={(event) => onVisualStyleChange(event.target.value)}
                    className="min-h-11 rounded border border-white/10 bg-ink/70 px-3 text-sm text-bone outline-none transition placeholder:text-muted focus:border-violet/70"
                    placeholder="Premium SaaS editorial, clean depth"
                  />
                </label>
              </div>
            </div>

            {error ? (
              <div className="mt-4 rounded border border-gold/40 bg-gold/10 p-3 text-sm leading-6 text-bone">
                {error}
              </div>
            ) : null}

            {image ? (
              <div className="mt-5 rounded border border-white/10 bg-white/[0.035] p-3">
                <img
                  src={image.image}
                  alt={`Generated visual for ${section.title}`}
                  className="max-h-[68vh] w-full rounded border border-white/10 object-contain"
                />
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => void downloadVisualAsPng(image.image, imageFilename(section.title))}
                    className="flex min-h-11 items-center justify-center gap-2 rounded border border-white/10 bg-white/[0.04] px-4 text-sm font-semibold text-bone transition hover:border-gold/60"
                  >
                    <FileText size={16} />
                    Download PNG
                  </button>
                  <button
                    type="button"
                    onClick={onGenerate}
                    disabled={isPending}
                    className="flex min-h-11 items-center justify-center gap-2 rounded border border-violet/70 bg-violet px-4 text-sm font-semibold text-white shadow-violet transition hover:bg-violetDeep disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-muted"
                  >
                    {isPending ? <Loader2 className="animate-spin" size={16} /> : <RefreshCcw size={16} />}
                    Regenerate image
                  </button>
                </div>
                <div className="mt-3 flex flex-col gap-1 text-xs leading-5 text-muted sm:flex-row sm:items-center sm:justify-between">
                  <span>
                    {image.template ? `${image.template.replace(/_/g, " ")} template` : "Template-rendered"} · {image.size || image.format}
                  </span>
                  <span>Clean text overlay</span>
                </div>
                {image.warning ? (
                  <p className="mt-2 text-xs leading-5 text-goldSoft">{image.warning}</p>
                ) : null}
              </div>
            ) : null}

            {!image ? (
              <button
                type="button"
                onClick={onGenerate}
                disabled={isPending}
                className="mt-5 flex min-h-12 w-full items-center justify-center gap-2 rounded border border-violet/70 bg-violet px-4 text-sm font-semibold text-white shadow-violet transition hover:bg-violetDeep disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-muted"
              >
                {isPending ? <Loader2 className="animate-spin" size={17} /> : <Wand2 size={17} />}
                {isPending ? "Generating visual..." : "Generate visual"}
              </button>
            ) : null}
          </>
        )}
      </div>
    </div>
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
  const isPro = plan !== "free";

  const filtered = store.saved.filter((item) => {
    const matchesCategory =
      categoryFilter === "none" || item.presetTopic === categoryFilter;
    const matchesPlatform =
      platformFilter === "all" ||
      item.sections.some((section) => sectionMatchesFilter(section, platformFilter));

    return matchesCategory && matchesPlatform;
  });

  return (
    <section className="scroll-mt-20 w-full min-w-0 rounded-2xl border border-white/10 bg-coal/88 p-4 backdrop-blur-xl sm:rounded sm:border sm:p-5">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-[0.72rem] font-semibold uppercase tracking-[0.14em] text-goldSoft sm:text-xs sm:tracking-[0.18em]">
            Saved library
          </p>
          <h2 className="mt-2 font-display text-[1.7rem] uppercase leading-none tracking-normal text-bone sm:text-2xl">
            Organized Outputs
          </h2>
          <p className="mt-2 max-w-none text-sm leading-6 text-muted sm:max-w-xl">
            Save generated sets, filter by platform or category, copy them back out, and remove anything you no longer need.
          </p>
        </div>
        {!isPro ? (
          <button
            type="button"
            onClick={() => onPlanChange("pro_creator")}
            className="flex min-h-11 items-center justify-center gap-2 rounded-xl border border-violet/70 bg-violet px-4 text-sm font-semibold text-white shadow-violet transition hover:bg-violetDeep sm:rounded"
          >
            <Lock size={16} />
            Unlock library
          </button>
        ) : null}
      </div>

      {!isPro ? (
        <div className="rounded-xl border border-white/10 bg-white/[0.035] p-4 text-sm leading-6 text-muted sm:rounded">
          Saved history is part of Pro. Upgrade or use the workspace plan switch while testing locally.
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
                  className="w-full min-w-0 rounded-xl border border-white/[0.08] bg-white/[0.035] p-4 sm:rounded sm:border-white/10"
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
                        className="grid h-10 w-10 place-items-center rounded-lg border border-white/10 bg-ink/70 text-bone transition hover:border-violet/60 sm:rounded"
                        aria-label="Copy saved content"
                      >
                        {copiedId === item.id ? <Check size={16} /> : <Copy size={16} />}
                      </button>
                      <button
                        type="button"
                        onClick={() => onDelete(item.id)}
                        className="grid h-10 w-10 place-items-center rounded-lg border border-white/10 bg-ink/70 text-muted transition hover:border-gold/60 hover:text-bone sm:rounded"
                        aria-label="Delete saved content"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                </article>
              ))
            ) : (
              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 text-sm text-muted sm:rounded">
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
  plan,
  usage,
  renderTimestamps,
  isOpen,
  onClose,
  onLoadResult,
  onLoadDraft
}: {
  store: StudioStore;
  current: GenerationResult;
  plan: PlanId;
  usage: UsageSummary;
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
          "fixed bottom-0 right-0 top-0 z-50 w-full max-w-md border-l border-white/10 bg-coal p-4 transition-transform duration-300 lg:static lg:z-auto lg:block lg:min-w-0 lg:max-w-none lg:translate-x-0 lg:overflow-hidden lg:rounded lg:border lg:bg-white/[0.035] lg:p-4",
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
          <UsageSummaryCard plan={plan} usage={usage} />

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

function UsageSummaryCard({ plan, usage }: { plan: PlanId; usage: UsageSummary }) {
  return (
    <section className="rounded-xl border border-gold/25 bg-gold/[0.07] p-3 sm:rounded">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-goldSoft">
        {labelForPlan(plan)}
      </p>
      <p className="mt-2 text-lg font-semibold text-bone">
        {usage.used} / {usage.limit} used
      </p>
      <p className="mt-1 text-xs text-muted">
        {usage.remaining} remaining
      </p>
    </section>
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
    <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-white/10 bg-ink/94 px-4 pb-4 pt-3 shadow-[0_-18px_45px_rgba(0,0,0,0.35)] backdrop-blur-xl lg:hidden">
      <div className="mx-auto grid max-w-md grid-cols-4 gap-2">
        <button
          type="button"
          onClick={onGenerate}
          disabled={!canGenerate}
          className="flex min-h-12 flex-col items-center justify-center gap-1 rounded-xl border border-violet/70 bg-violet text-[0.7rem] font-semibold text-white shadow-violet disabled:border-white/10 disabled:bg-white/10 disabled:text-muted"
        >
          {isPending ? <Loader2 className="animate-spin" size={17} /> : <Sparkles size={17} />}
          Generate
        </button>
        <button
          type="button"
          onClick={onSave}
          className="flex min-h-12 flex-col items-center justify-center gap-1 rounded-xl border border-white/10 bg-white/[0.025] text-[0.7rem] font-semibold text-bone"
        >
          {saved ? <BookmarkCheck size={17} /> : <Bookmark size={17} />}
          Save
        </button>
        <button
          type="button"
          onClick={onSaveDraft}
          className="flex min-h-12 flex-col items-center justify-center gap-1 rounded-xl border border-white/10 bg-white/[0.025] text-[0.7rem] font-semibold text-bone"
        >
          <Clipboard size={17} />
          Draft
        </button>
        <button
          type="button"
          onClick={onOpenHistory}
          className="flex min-h-12 flex-col items-center justify-center gap-1 rounded-xl border border-white/10 bg-white/[0.025] text-[0.7rem] font-semibold text-bone"
        >
          <History size={17} />
          History
        </button>
      </div>
    </nav>
  );
}
