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
  Undo2,
  Wand2,
  X
} from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { clsx } from "clsx";
import { CheckoutButton } from "@/components/billing-buttons";
import { BrandLogo } from "@/components/brand-logo";
import { LogoutButton } from "@/components/logout-button";
import { StudioComposer } from "@/components/studio-composer";
import { createWorkspaceWriter } from "@/lib/workspace-sync";
import type { WorkspaceSnapshot, WorkspacePreferences } from "@/lib/workspace-contract";
import type { GenerationInput } from "@/lib/generation-contract";
import type { CreativeSetting } from "@/types/content";
import { REFINEMENT_ACTIONS } from "@/lib/generation-contract";
import { captionHashtags, excludeCaptionHashtags } from "@/lib/hashtag-output";
import { generationFailure, type GenerationFailure } from "@/lib/generation-feedback";
import {
  buildGenerationCopyText,
  buildSectionCopyText,
  copyPlainText
} from "@/lib/copy";
import { formatOutputSection, formatSectionPlainText, formatSectionImageText, OutputBlock } from "@/lib/output-format";
import { isImageContentType } from "@/lib/image-generation-contract";
import { IMAGE_MODES, backgroundFromDesignImage, buildCreativeBrief, normaliseDesign } from "@/lib/image-design";
import type { ImageMode, ImageDesign } from "@/lib/image-design";
import { buildSocialPosterContent, renderSocialPosterSvg, svgToDataUrl } from "@/lib/social-image";
import { boundDeviceImages, readDeviceImages, saveDeviceImages } from "@/lib/image-device-store";
import { ImageDesignEditor } from "@/components/image-design-editor";
import { ImageChoices } from "@/components/image-choices";
import { DEFAULT_APPEARANCE, type ImageAppearance } from "@/lib/image-appearance";
import { cleanPlainText } from "@/lib/text-normalize";
import { plainPostText, socialPostTypes } from "@/lib/post-format";
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
import type { UsageSummary, BrandProfile } from "@/types/saas";

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
  platform?: string;
  contentType?: ContentTypeId;
  design?: ImageDesign;
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
  return plainPostText(value);
}

export function StudioShell({
  embedded = false,
  initialPlan = "free",
  authenticated = false,
  accountId,
  initialUsage
}: {
  embedded?: boolean;
  initialPlan?: PlanId;
  authenticated?: boolean;
  accountId?: string;
  initialUsage?: UsageSummary;
}) {
  const [source, setSource] = useState("");
  const [automaticSettings, setAutomaticSettings] = useState<CreativeSetting[]>(["tone", "sharpness", "ctaMode", "presetTopic", "length"]);
  const [brandName, setBrandName] = useState("");
  const [audience, setAudience] = useState("");
  const [offer, setOffer] = useState("");
  const [writingStyle, setWritingStyle] = useState("");
  const [contentGoal, setContentGoal] = useState("");
  const [length, setLength] = useState<"short" | "standard" | "detailed">("standard");
  const [tone, setTone] = useState<ToneId>("professional");
  const [lastUsedTone, setLastUsedTone] = useState<ToneId | null>(null);
  const [sharpness, setSharpness] = useState<SharpnessId>("balanced");
  const [ctaMode, setCtaMode] = useState<CtaModeId>("soft");
  const [presetTopic, setPresetTopic] = useState<PresetTopicId>("business");
  const [selectedTypes, setSelectedTypes] = useState<ContentTypeId[]>(["linkedin"]);
  const [activeFilter, setActiveFilter] = useState<FilterId>("all");
  const plan = initialPlan;
  const [brandProfiles, setBrandProfiles] = useState<BrandProfile[]>([]);
  const [saveStatus, setSaveStatus] = useState("");
  const [historyWarning, setHistoryWarning] = useState("");
  const [undoResults, setUndoResults] = useState<GenerationResult[]>([]);
  const requestAttempt = useRef<{ fingerprint: string; id: string } | null>(null);
  const imageRequestAttempt = useRef<{ fingerprint: string; id: string } | null>(null);
  const imageInFlight = useRef(false);
  const retryIntent = useRef<{ source: string; refinement?: { section: GeneratedSection; action: string } } | null>(null);
  const workspaceWriter = useRef<ReturnType<typeof createWorkspaceWriter> | null>(null);
  const activeAccount = useRef(accountId);
  const accountEpoch = useRef(0);
  const hydratedEpoch = useRef(-1);
  const lastWorkspaceState = useRef("");
  const needsWorkspaceBaseline = useRef(true);
  const [workspaceReady, setWorkspaceReady] = useState(false);
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
  const [failedGeneration, setFailedGeneration] = useState<GenerationFailure | null>(null);
  const [showEarlierResult, setShowEarlierResult] = useState(false);
  const [canStartNewAttempt, setCanStartNewAttempt] = useState(false);
  const [copiedId, setCopiedId] = useState("");
  const [historyOpen, setHistoryOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const [imageSection, setImageSection] = useState<GeneratedSection | null>(null);
  const [imageStyle, setImageStyle] = useState<ImageStyle>("premium");
  const [imageFormat, setImageFormat] = useState<ImageFormat>("square");
  const [imageMode, setImageMode] = useState<ImageMode>("auto");
  const [imageAppearance, setImageAppearance] = useState<ImageAppearance>(DEFAULT_APPEARANCE);
  const [imageInstructions, setImageInstructions] = useState("");
  const [imageSource, setImageSource] = useState("");
  const [imageIndustry, setImageIndustry] = useState("");
  const [imagePlatform, setImagePlatform] = useState("LinkedIn");
  const [imageBrandColors, setImageBrandColors] = useState("");
  const [imageVisualStyle, setImageVisualStyle] = useState("");
  const [imagePending, setImagePending] = useState(false);
  const [imageError, setImageError] = useState("");
  const [generatedImages, setGeneratedImages] = useState<Record<string, GeneratedImage>>({});
  const [imageStorageAccount, setImageStorageAccount] = useState<string | null>(null);
  const imageUndo = useRef<GeneratedImage | null>(null);
  useEffect(() => {
    if (!accountId || imageStorageAccount !== accountId || !authenticated) return;
    void saveDeviceImages(accountId, generatedImages).catch(() => {
      if (activeAccount.current === accountId) setImageError("Device storage is unavailable. Download your design to keep it.");
    });
  }, [generatedImages, imageStorageAccount, accountId, authenticated]);
  const outputWorkspaceRef = useRef<HTMLElement | null>(null);
  const pendingAutoScrollIdRef = useRef("");
  const lastAutoScrolledIdRef = useRef("");
  const isGeneratingRef = useRef(false);
  const userInteractedDuringGenerationRef = useRef(false);

  useEffect(() => {
    activeAccount.current = accountId;
    accountEpoch.current++;
    let canceled = false;
    const timeout = window.setTimeout(async () => {
      setHasMounted(false);
      setWorkspaceReady(false);
      lastWorkspaceState.current = "";
      needsWorkspaceBaseline.current = true;
      requestAttempt.current = null;
      setFailedGeneration(null); setShowEarlierResult(false); setError(""); setCanStartNewAttempt(false);
      imageRequestAttempt.current = null;
      setGeneratedImages({});
      setImageSection(null);
      setImageError("");
      setImageStorageAccount(null);
      setImageSource(""); setImageInstructions(""); setImageIndustry("");
      setImageBrandColors(""); setImageVisualStyle(""); imageUndo.current = null;
      setImageAppearance(DEFAULT_APPEARANCE); setImageMode("auto");
      setSource(""); setBrandName(""); setAudience(""); setOffer(""); setWritingStyle(""); setContentGoal("");
      setTone("professional"); setSharpness("balanced"); setCtaMode("soft"); setPresetTopic("none"); setLength("standard");
      setSelectedTypes(["linkedin"]); setResult(sampleResult); setUndoResults([]);
      isGeneratingRef.current = false; setIsPending(false);
      setAutomaticSettings(["tone", "sharpness", "ctaMode", "presetTopic", "length"]);
      if (accountId && authenticated) void readDeviceImages<GeneratedImage>(accountId).then(images => {
        if (!canceled) { setGeneratedImages(current => ({ ...images, ...current })); setImageStorageAccount(accountId); }
      }).catch(() => { if (!canceled) setImageError("Device designs could not be loaded. Downloads remain available."); });
      retryIntent.current = null;
      const nextStore = readStore(accountId);
      let storedTone: ToneId | null = null;
      try { storedTone = window.localStorage.getItem(`${LAST_USED_TONE_KEY}:${accountId ?? "guest"}`) as ToneId | null; } catch { /* Storage is optional. */ }

      setStore(nextStore);
      const deviceDraft = nextStore.drafts.find(d => d.id === "current-draft");
      if (deviceDraft) {
        setSource(deviceDraft.source); setBrandName(deviceDraft.brandName ?? "");
        setAudience(deviceDraft.audience ?? ""); setOffer(deviceDraft.offer ?? "");
        setWritingStyle(deviceDraft.writingStyle ?? ""); setContentGoal(deviceDraft.contentGoal ?? "");
        setTone(deviceDraft.tone); setSelectedTypes(deviceDraft.selectedTypes);
        setAutomaticSettings(deviceDraft.automaticSettings ?? []); setLength(deviceDraft.length ?? "standard");
      }
      if (storedTone && tones.some((item) => item.id === storedTone)) {
        setTone(storedTone);
        setLastUsedTone(storedTone);
      }
      if (!authenticated) {
        setAnonymousUsed(monthlyStoredGenerationCount(nextStore));
      }
      if (authenticated && accountId) {
        try {
          const response = await fetch("/api/workspace", { cache: "no-store", headers: { "X-ContentOS-Account": accountId }, signal: AbortSignal.timeout(15000) });
          if (!response.ok) throw new Error("Account workspace could not load. Device copy remains available.");
          const snapshot = await response.json() as WorkspaceSnapshot;
          if (canceled) return;
          // Keep a recoverable device copy before accepting the server snapshot.
          try {
            const key = `contentos:recovery:${accountId}`;
            const raw = window.localStorage.getItem(key);
            const previous = raw ? JSON.parse(raw) : [];
            const copies: StudioStore[] = Array.isArray(previous) ? previous : [previous];
            const serialized = JSON.stringify(nextStore);
            if ((nextStore.recent.length || nextStore.saved.length || nextStore.drafts.length) && !copies.some(copy => JSON.stringify(copy) === serialized)) {
              window.localStorage.setItem(key, JSON.stringify([nextStore, ...copies].slice(0, 3)));
            }
          } catch { /* Best effort recovery copy. */ }
          setStore(snapshot.store);
          setHistoryWarning(snapshot.unavailableHistoryCount ? `${snapshot.unavailableHistoryCount} older history item(s) cannot be displayed. Original records are retained in your account.` : "");
          setBrandProfiles(snapshot.brandProfiles);
          const p = snapshot.preferences;
          setBrandName(p.brandName); setAudience(p.audience); setOffer(p.offer);
          setWritingStyle(p.writingStyle); setContentGoal(p.contentGoal);
          setImageBrandColors(p.brandColors ?? ""); setImageVisualStyle(p.visualStyle ?? "");
          setLength(p.length ?? "standard");
          // Legacy saved choices remain explicit; only absent preferences are inferred.
          setAutomaticSettings(p.automaticSettings ?? (["tone", "sharpness", "ctaMode", "presetTopic", "length"] as CreativeSetting[]).filter(key => p[key] === undefined));
          if (p.tone) setTone(p.tone);
          if (p.sharpness) setSharpness(p.sharpness);
          if (p.ctaMode) setCtaMode(p.ctaMode);
          if (p.presetTopic) setPresetTopic(p.presetTopic);
          if (p.selectedTypes?.length) setSelectedTypes(p.selectedTypes);
          const autosave = snapshot.store.drafts.find(d => d.id === "current-draft");
          if (autosave) setSource(autosave.source);
          const selectedId = new URL(window.location.href).searchParams.get("generation");
          const selected = snapshot.store.recent.find(item => item.id === selectedId) ?? snapshot.store.recent[0];
          if (selected) setResult(selected);
          workspaceWriter.current = createWorkspaceWriter(snapshot.revision, async input => {
            const saved = await fetch("/api/workspace", { method: "PUT", headers: { "Content-Type": "application/json", "X-ContentOS-Account": accountId }, body: JSON.stringify(input) });
            if (saved.status === 409) {
              const conflict = await saved.json();
              throw new Error(conflict.code === "account_changed" ? "Your signed-in account changed. Download this draft before reloading." : "Newer edits exist in another tab. Download your changes before reloading.");
            }
            if (!saved.ok) throw new Error("Account save failed. Your device copy is retained; download it before reloading.");
            return await saved.json() as WorkspaceSnapshot;
          }, message => { if (!canceled) setSaveStatus(message); });
          setWorkspaceReady(true);
        } catch (err) {
          if (!canceled) setSaveStatus(err instanceof Error ? err.message : "Account workspace unavailable.");
        }
      } else {
        const autosave = nextStore.drafts.find(d => d.id === "current-draft");
        if (autosave) { setSource(autosave.source); setBrandName(autosave.brandName ?? ""); setAudience(autosave.audience ?? ""); setOffer(autosave.offer ?? ""); setWritingStyle(autosave.writingStyle ?? ""); setContentGoal(autosave.contentGoal ?? ""); }
      }
      if (canceled) return;
      hydratedEpoch.current = accountEpoch.current;
      setHasMounted(true);
    }, 0);

    return () => { canceled = true; workspaceWriter.current?.dispose(); workspaceWriter.current = null; window.clearTimeout(timeout); };
  }, [authenticated, accountId]);

  useEffect(() => {
    if (!hasMounted || hydratedEpoch.current !== accountEpoch.current) {
      return;
    }

    writeStore(store, accountId);
  }, [hasMounted, store, accountId]);

  useEffect(() => {
    if (!hasMounted || hydratedEpoch.current !== accountEpoch.current) return;
    const preferences: WorkspacePreferences = { brandName, audience, offer, writingStyle, contentGoal, tone, sharpness, ctaMode, presetTopic, selectedTypes, automaticSettings, length, brandColors: imageBrandColors, visualStyle: imageVisualStyle };
    const draft: Draft = { ...preferences, id: "current-draft", title: source.trim().slice(0, 54) || "Current draft", source, tone, selectedTypes, updatedAt: new Date().toISOString() };
    const nextStore = upsertDraft(store, draft);
    const localSaved = writeStore(nextStore, accountId);
    const stateKey = JSON.stringify({ source, preferences, store });
    // Hydration is a read, not an edit. A passive second device must not advance
    // the server revision or make an actively editing device stale.
    if (needsWorkspaceBaseline.current) {
      needsWorkspaceBaseline.current = false;
      lastWorkspaceState.current = stateKey;
      return;
    }
    const timer = window.setTimeout(() => {
      if (stateKey === lastWorkspaceState.current) return;
      lastWorkspaceState.current = stateKey;
      if (workspaceReady && workspaceWriter.current) void workspaceWriter.current.enqueue({ store: nextStore, preferences });
      else if (!authenticated) setSaveStatus(localSaved ? "Draft saved on this device" : "Draft not saved. Download a copy of your content.");
    }, 700);
    return () => window.clearTimeout(timer);
  }, [hasMounted, accountId, authenticated, workspaceReady, source, brandName, audience, offer, writingStyle, contentGoal, tone, sharpness, ctaMode, presetTopic, selectedTypes, store, automaticSettings, length, imageBrandColors, imageVisualStyle]);

  useEffect(() => {
    isGeneratingRef.current = isPending;
  }, [isPending]);

  useEffect(() => {
    const protectDraft = (event: BeforeUnloadEvent) => {
      if (isGeneratingRef.current || workspaceWriter.current?.hasPending() ||
          document.querySelector('[data-content-editing="true"]')) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", protectDraft);
    return () => window.removeEventListener("beforeunload", protectDraft);
  }, []);

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
    hasMounted &&
    source.trim().length > 7 &&
    selectedTypes.length > 0 &&
    !isPending &&
    usage.remaining > 0 &&
    (isPro || !hasPaidSelection);

  function persistStore(nextStore: StudioStore) {
    setStore(nextStore);
    setSaveStatus(writeStore(nextStore, accountId) ? "Saved on this device" : "Not saved on this device. Download a copy.");
  }

  async function generateContent(nextSource = source, refinement?: { section: GeneratedSection; action: string }) {
    if (!hasMounted || isGeneratingRef.current) return;
    if (document.querySelector('[data-content-editing="true"]')) {
      setError("Apply or cancel your manual edits before generating another version.");
      return;
    }
    setError("");
    setCanStartNewAttempt(false);
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

    const payload: GenerationInput = {
      source: refinement ? result.source : cleanedSource,
      brandName,
      audience,
      offer,
      writingStyle,
      contentGoal,
      tone,
      sharpness,
      ctaMode,
      presetTopic,
      selectedTypes: refinement ? [refinement.section.type] : selectedTypes,
      length,
      automaticSettings,
      ...(refinement ? { refinement: { action: Object.hasOwn(REFINEMENT_ACTIONS, refinement.action) ? refinement.action as NonNullable<GenerationInput["refinement"]>["action"] : "custom", ...(Object.hasOwn(REFINEMENT_ACTIONS, refinement.action) ? {} : { instructions: refinement.action }), section: refinement.section, ...(refinement.section.type === "platformHashtags" ? { captionHashtags: captionHashtags(result) } : {}) } } : {})
    };
    const fingerprint = JSON.stringify(payload);
    retryIntent.current = { source: nextSource, refinement };
    if (requestAttempt.current?.fingerprint !== fingerprint) requestAttempt.current = { fingerprint, id: crypto.randomUUID() };

    let failureCode: string | undefined;
    const generationEpoch = accountEpoch.current;
    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-ContentOS-Account": accountId ?? ""
        },
        body: JSON.stringify({ ...payload, requestId: requestAttempt.current.id })
      });

      const data = (await response.json()) as GenerationResult | { error?: string; code?: string };
      if (activeAccount.current !== accountId || accountEpoch.current !== generationEpoch) return;

      if (!response.ok) {
        failureCode = "code" in data ? data.code : undefined;
        const message = "error" in data ? data.error : undefined;
        throw new Error(message ?? "Generation failed.");
      }

      if (!("sections" in data)) {
        throw new Error("Generation returned an unexpected response.");
      }

      const cleanedResult = cleanGenerationResult(data);
      setFailedGeneration(null);
      setShowEarlierResult(false);
      requestAttempt.current = null;
      retryIntent.current = null;
      pendingAutoScrollIdRef.current = cleanedResult.id;
      if (refinement) {
        const replacement = cleanedResult.sections.find(s => s.type === refinement.section.type);
        if (!replacement) throw new Error("The refinement did not return the requested content.");
        editSection({ ...replacement, id: refinement.section.id }, "refined");
      } else {
        setUndoResults([]);
        setResult(cleanedResult);
        persistStore(addRecent(store, cleanedResult));
      }
      if (authenticated) {
        setUsageUsed((current) => current + 1);
      } else {
        setAnonymousUsed(monthlyStoredGenerationCount(addRecent(store, cleanedResult)));
      }
    } catch (generationError) {
      if (activeAccount.current !== accountId || accountEpoch.current !== generationEpoch) return;
      const failure = generationFailure(payload.source, Boolean(refinement), generationError instanceof Error ? generationError.message : "Generation failed.", failureCode);
      setFailedGeneration({ ...failure, accountId, requestedChange: refinement?.action });
      setShowEarlierResult(false);
      setCanStartNewAttempt(failure.canStartNew);
      setError("");
    } finally {
      if (activeAccount.current === accountId && accountEpoch.current === generationEpoch) {
        isGeneratingRef.current = false;
        setIsPending(false);
      }
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
      brandName, audience, offer, writingStyle, contentGoal,
      automaticSettings, length,
      tone,
      sharpness,
      ctaMode,
      presetTopic,
      selectedTypes
    };

    persistStore(upsertDraft(store, draft));
  }

  function loadDraft(draft: Draft) {
    setAutomaticSettings(draft.automaticSettings ?? []); setLength(draft.length ?? "standard");
    setSource(cleanPlainText(draft.source));
    setTone(draft.tone);
    setSharpness(draft.sharpness ?? "balanced");
    setCtaMode(draft.ctaMode ?? "soft");
    setPresetTopic(draft.presetTopic ?? "none");
    setSelectedTypes(draft.selectedTypes);
    setBrandName(draft.brandName ?? ""); setAudience(draft.audience ?? "");
    setOffer(draft.offer ?? ""); setWritingStyle(draft.writingStyle ?? ""); setContentGoal(draft.contentGoal ?? "");
    setHistoryOpen(false);
  }

  function saveCurrent() {
    if (failedGeneration && !showEarlierResult) return;
    if (!isPro) {
      setError("Saved history is a Pro feature.");
      return;
    }

    persistStore(toggleSaved(store, result));
  }

  function deleteSaved(id: string) {
    persistStore(removeSaved(store, id));
  }

  function editSection(section: GeneratedSection, revisionSource: "manual" | "refined" = "manual") {
    setUndoResults(current => [...current.slice(-19), result]);
    const edited = excludeCaptionHashtags({ ...result, sections: result.sections.map(s => s.id === section.id ? { ...section, revisionSource } : s) });
    setResult(edited);
    persistStore({ ...addRecent(store, edited), saved: store.saved.map(s => s.id === edited.id ? edited : s) });
  }

  function undoEdit() {
    const previous = undoResults.at(-1);
    if (!previous) return;
    setUndoResults(current => current.slice(0, -1));
    setResult(previous);
    persistStore({ ...addRecent(store, previous), saved: store.saved.map(s => s.id === previous.id ? previous : s) });
  }

  function viewPlans() { window.location.assign("/pricing"); }

  function scrollToStudioSection(target: "composer" | "outputs" | "formatter") {
    const section = document.getElementById(target);
    const disclosure = section?.closest("details");
    if (disclosure) disclosure.open = true;
    section?.scrollIntoView({
      behavior: "smooth",
      block: "start"
    });
    if (target === "formatter") section?.querySelector<HTMLTextAreaElement>("textarea")?.focus({ preventScroll: true });
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
    if (!section || imageInFlight.current) {
      return;
    }

    if (!isImageContentType(section.type)) {
      setImageError("Hashtag and keyword sets are caption text. Choose a post or caption to create an image.");
      return;
    }

    if (!isProStudio) {
      setImageError("Image generation is available on Pro Studio.");
      return;
    }

    imageInFlight.current = true;
    setImagePending(true);
    setImageError("");

    try {
      // The image uses a bounded excerpt; the original section and preferences stay intact.
      const excerpt = (value: string, limit: number) => value.trim().slice(0, limit);
      const outputText = excerpt(imageSource || imageInstructions, 2600);
      const payload = {
        outputText,
        mode: imageMode,
        creativeInstructions: excerpt(imageInstructions, 600),
        appearance: imageAppearance,
        platform: excerpt(imagePlatform || section.platform, 80),
        contentType: excerpt(section.title === "Original visual" || section.title === "Saved visual" ? imagePlatform : labelForContentType(section.type), 80),
        style: imageStyle,
        format: imageFormat,
        brandContext: {
          industry: excerpt(imageIndustry, 180),
          brandName: excerpt(brandName, 140), audience: excerpt(audience, 220), offer: excerpt(offer, 220),
          writingStyle: excerpt(writingStyle, 180), contentGoal: excerpt(contentGoal, 180),
          brandColors: excerpt(imageBrandColors, 180),
          visualStyle: excerpt(imageVisualStyle, 180),
          contentTopic: excerpt(section.title || labelForContentType(section.type), 180)
        }
      };
      const fingerprint = JSON.stringify({ accountId, ...payload });
      if (imageRequestAttempt.current?.fingerprint !== fingerprint) {
        imageRequestAttempt.current = { fingerprint, id: crypto.randomUUID() };
      }
      const attempt = imageRequestAttempt.current;
      const response = await fetch("/api/generate-image", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-ContentOS-Account": accountId ?? ""
        },
        body: JSON.stringify({ ...payload, requestId: attempt.id })
      });
      const data = (await response.json()) as {
        design?: ImageDesign;
        image?: string;
        mimeType?: string;
        size?: string;
        style?: ImageStyle;
        format?: ImageFormat;
        template?: string;
        imageCreditsLimit?: number;
        creditCharged?: boolean;
        warning?: string;
        createdAt?: string;
        error?: unknown;
        code?: string;
      };
      if (activeAccount.current !== accountId) return;

      if (!response.ok || !data.image) {
        // Only terminal failures permit a fresh ID on the next explicit click.
        // Pending, network errors and uncertain saves must keep the original ID.
        if (data.code === "request_failed" || data.code === "request_expired") imageRequestAttempt.current = null;
        throw new Error(typeof data.error === "string" ? data.error : response.status === 403
          ? "This environment is blocking image generation. Your content is unchanged."
          : "Image generation could not be confirmed. Your content is unchanged; retrying checks the same request.");
      }

      imageRequestAttempt.current = null;
      const generatedImage = data.image;

      setGeneratedImages((current) => boundDeviceImages({
        ...current,
        [section.id]: {
          platform: payload.platform,
          contentType: section.type,
          design: data.design,
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
      if (activeAccount.current !== accountId) return;
      setImageError(
        imageGenerationError instanceof Error
          ? imageGenerationError.message
          : "Image generation failed. Try again."
      );
    } finally {
      imageInFlight.current = false;
      setImagePending(false);
    }
  }

  function editImage(design: ImageDesign) {
    if (!imageSection || imagePending || !accountId || activeAccount.current !== accountId) return;
    const current = generatedImages[imageSection.id];
    if (!current?.design) return;
    imageUndo.current = current;
    const input = { outputText: "", platform: imagePlatform, contentType: "", style: current.style, format: current.format, brandContext: {} };
    const clean = normaliseDesign(design);
    const rendered = renderSocialPosterSvg({ ...input, design: clean, content: buildSocialPosterContent(input), backgroundDataUrl: backgroundFromDesignImage(current.image) });
    setGeneratedImages(images => ({ ...images, [imageSection.id]: { ...current, design: clean, image: svgToDataUrl(rendered.svg), createdAt: new Date().toISOString() } }));
  }

  return (
    <main className="premium-studio min-h-screen w-full overflow-x-hidden pb-28 text-bone lg:pb-0">
      <TopBar
        authenticated={authenticated}
        menuOpen={menuOpen}
        plan={plan}
        onToggleMenu={() => setMenuOpen((value) => !value)}
      />

      <div className="relative mx-auto w-full max-w-[100rem] min-w-0 space-y-4 px-3 pb-6 pt-4 sm:px-5 lg:grid lg:grid-cols-[4.5rem_minmax(0,1fr)] lg:gap-6 lg:space-y-0 lg:px-6 lg:pt-6">
        <DesktopRail onNavigate={handleRailAction} />

        <div className="w-full min-w-0 overflow-hidden space-y-4">
          <div className="flex justify-end">
            <button type="button" onClick={() => {
              const selected = selectedTypes.length === 1 && isImageContentType(selectedTypes[0]) ? contentTypes.find(type => type.id === selectedTypes[0]) : undefined;
              const platform = filters.find(filter => filter.id === selected?.group)?.label ?? "General";
              setImagePlatform(platform);
              setImageSection({ id: `visual-${crypto.randomUUID()}`, type: selected?.id ?? "linkedin", title: "Original visual", platform, body: "", items: [] });
              setImageSource(""); setImageError(""); imageUndo.current = null;
            }} className="flex min-h-11 items-center gap-2 rounded border border-white/15 px-4 text-sm hover:border-violet">
              <Wand2 size={16} /> Image Studio
            </button>
          </div>
          <section className="block w-full min-w-0 space-y-6 xl:grid xl:grid-cols-[minmax(20rem,0.8fr)_minmax(28rem,1.2fr)] xl:items-start xl:gap-8 xl:space-y-0">
            <StudioComposer
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
              length={length}
              automaticSettings={automaticSettings}
              onAutomaticChange={(key, automatic) => setAutomaticSettings(current => automatic ? [...new Set([...current, key])] : current.filter(k => k !== key))}
              onSelectPlatform={type => { setSelectedTypes([type]); setActiveFilter("all"); }}
              brandColors={imageBrandColors}
              onBrandColorsChange={setImageBrandColors}
              onLengthChange={setLength}
              plan={plan}
              usage={usage}
              canGenerate={canGenerate}
              isPending={isPending}
              isLoading={!hasMounted}
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
                  try { window.localStorage.setItem(`${LAST_USED_TONE_KEY}:${accountId ?? "guest"}`, value); } catch { /* Storage is optional. */ }
                }
              }}
              onSharpnessChange={setSharpness}
              onCtaModeChange={setCtaMode}
              onPresetTopicChange={setPresetTopic}
              onToggleType={toggleType}
              onGenerate={() => generateContent()}
              onSaveDraft={saveDraft}
              brandProfiles={brandProfiles}
              onSelectBrand={(brand) => {
                setBrandName(brand.name); setAudience(brand.audience); setOffer(brand.offer);
                setWritingStyle(brand.writing_preferences);
                setAutomaticSettings(current => current.filter(k => k !== "tone" && k !== "ctaMode"));
                if (tones.some(t => t.id === brand.tone)) setTone(brand.tone as ToneId);
                if (ctaModes.some(c => c.id === brand.cta_style)) setCtaMode(brand.cta_style as CtaModeId);
              }}
            />

            <OutputPanel
              id="outputs"
              containerRef={outputWorkspaceRef}
              result={result}
              sourceText={result.source}
              currentSource={source}
              activeFilter={activeFilter}
              visibleSections={visibleSections}
              error={error}
              failure={failedGeneration?.accountId === accountId ? failedGeneration : null}
              showEarlierResult={showEarlierResult}
              onShowEarlier={() => setShowEarlierResult(true)}
              copiedId={copiedId}
              isPending={isPending}
              plan={plan}
              generatedImages={generatedImages}
              onFilterChange={setActiveFilter}
              onCopySection={copySection}
              onOpenImagePanel={(section) => {
                if (!isImageContentType(section.type)) return;
                setImageSection(section);
                setImageSource(formatSectionImageText(section, result.source).slice(0, 2600));
                setImagePlatform(section.platform); imageUndo.current = null;
                setImageError("");
              }}
              onRegenerate={() => generateContent()}
              onSaveCurrent={saveCurrent}
              onEditSection={editSection}
              onUndo={undoEdit}
              canUndo={undoResults.length > 0}
              onCopyRefinement={(section, action) => void generateContent(source, { section, action })}
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

          {canStartNewAttempt ? <div><button type="button" disabled={isPending} onClick={() => { requestAttempt.current = null; const intent = retryIntent.current; void generateContent(intent?.source ?? source, intent?.refinement); }} className="flex min-h-11 items-center gap-2 rounded border border-white/20 px-4 text-sm"><RefreshCcw size={16} />Try latest request again</button><p className="mt-2 text-xs text-muted">Starts a new AI request. Provider costs may apply even if the result is rejected.</p></div> : null}

          <p className="min-h-5 text-xs text-muted" role="status">{saveStatus}</p>
          {historyWarning ? <p className="text-xs text-amber-200" role="status">{historyWarning}</p> : null}
          <button type="button" onClick={() => {
            let recovered = null;
            try { recovered = accountId ? JSON.parse(window.localStorage.getItem(`contentos:recovery:${accountId}`) ?? "null") : null; } catch { /* Export current copy if recovery storage is unavailable. */ }
            const backup = { current: readStore(accountId), previousDeviceCopies: recovered };
            const url = URL.createObjectURL(new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" }));
            const link = document.createElement("a"); link.href = url; link.download = "contentos-workspace-backup.json"; link.click(); URL.revokeObjectURL(url);
          }} className="flex min-h-10 items-center gap-2 text-xs text-muted"><Save size={14} />Export device backup</button>
          <details className="border-y border-white/10 py-4">
            <summary className="cursor-pointer text-sm font-semibold">Text formatter</summary>
            <PlatformFormatterPanel id="formatter" plan={plan} onPlanChange={viewPlans} />
          </details>

          <SavedLibraryPanel
            store={store}
            plan={plan}
            onPlanChange={viewPlans}
            onOpen={(item) => { setResult(item); setShowEarlierResult(true); setUndoResults([]); setActiveFilter("all"); scrollToStudioSection("outputs"); }}
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
            setShowEarlierResult(true);
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
        studio={{ mode: imageMode, instructions: imageInstructions, source: imageSource, industry: imageIndustry, platform: imagePlatform,
          appearance: imageAppearance, onAppearance: setImageAppearance,
          onMode: setImageMode, onInstructions: setImageInstructions, onSource: setImageSource, onIndustry: setImageIndustry, onPlatform: setImagePlatform,
          onEdit: editImage, onUndo: () => {
            if (!imageSection || !imageUndo.current || imagePending) return;
            const previous = imageUndo.current; imageUndo.current = null;
            setGeneratedImages(images => ({ ...images, [imageSection.id]: previous }));
          }, canUndo: Boolean(imageUndo.current), saved: generatedImages, onOpenSaved: (id: string) => {
            const saved = generatedImages[id];
            const platform = saved?.platform ?? "General";
            setImagePlatform(platform);
            setImageSection({ id, type: saved?.contentType ?? "linkedin", title: "Saved visual", platform, body: "", items: [] });
            imageUndo.current = null;
          } }}
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
          canSave={!isPending && (!failedGeneration || showEarlierResult)}
          earlierResult={Boolean(failedGeneration)}
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

        <div className="relative z-[90] flex shrink-0 items-center lg:hidden" onKeyDown={event => {
          if (event.key === "Escape" && menuOpen) {
            event.preventDefault();
            onToggleMenu();
            event.currentTarget.querySelector<HTMLButtonElement>("button[aria-expanded]")?.focus();
          }
        }}>
          <button
            type="button"
            onClick={onToggleMenu}
            className="grid h-10 w-10 place-items-center rounded-lg border border-white/10 bg-white/[0.04] text-muted"
            aria-label={menuOpen ? "Close account menu" : "Open account menu"}
            aria-expanded={menuOpen}
            aria-controls="studio-account-menu"
          >
            {menuOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
          {menuOpen ? (
            <div id="studio-account-menu" className="absolute right-0 top-full z-[100] mt-2 w-[11.25rem] rounded-xl border border-white/10 bg-[#07050d] p-1.5 shadow-[0_18px_45px_rgba(0,0,0,0.55)]">
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


function OutputPanel({
  id,
  containerRef,
  result,
  sourceText,
  currentSource,
  activeFilter,
  visibleSections,
  error,
  failure,
  showEarlierResult,
  onShowEarlier,
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
  onEditSection,
  onUndo,
  canUndo,
  onCopyRefinement,
  onCopyAll,
  onDownload
}: {
  id: string;
  containerRef: React.RefObject<HTMLElement | null>;
  result: GenerationResult;
  sourceText: string;
  currentSource: string;
  activeFilter: FilterId;
  visibleSections: GeneratedSection[];
  error: string;
  failure: GenerationFailure | null;
  showEarlierResult: boolean;
  onShowEarlier: () => void;
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
  onEditSection: (section: GeneratedSection) => void;
  onUndo: () => void;
  canUndo: boolean;
  onCopyRefinement: (section: GeneratedSection, action: string) => void;
  onCopyAll: () => void;
  onDownload: () => void;
}) {
  const earlier = Boolean(failure) || result.source.trim() !== currentSource.trim();
  const failureNotice = failure && !isPending ? <div role="alert" data-testid="generation-failure" className="mb-6 rounded border border-gold/40 bg-gold/10 p-4 text-sm leading-6 text-bone">
    <h2 className="text-base font-semibold">{failure.uncertain ? "Latest result not confirmed" : failure.refinement ? "Latest refinement failed" : "Latest generation failed"}</h2>
    <p className="mt-2">{failure.uncertain ? "The latest request did not return a confirmed result. Your earlier draft is preserved. Retry the unchanged request to check its status." : "The latest request did not produce an accepted result. Your earlier draft is preserved; it is not output from this request."}</p>
    <p className="mt-3 font-semibold">{failure.refinement ? "Brief for the failed refinement" : "Latest request"}</p>
    <blockquote className="whitespace-pre-wrap break-words [overflow-wrap:anywhere]">{failure.source}</blockquote>
    {failure.requestedChange ? <p className="mt-2 break-words">Requested change: {failure.requestedChange}</p> : null}
    <p className="mt-3 text-muted">{failure.message}</p>
    {result.id !== "sample" && !showEarlierResult ? <button type="button" onClick={onShowEarlier} className="mt-3 min-h-11 rounded border border-white/20 px-3 font-semibold">Show earlier draft</button> : null}
  </div> : null;
  if (failure && !showEarlierResult && !isPending) return <section id={id} ref={containerRef} className="min-w-0 scroll-mt-20">{failureNotice}</section>;
  if (result.id === "sample" && !isPending) return <section id={id} ref={containerRef} className="min-w-0 border-t border-white/10 py-6 xl:border-t-0">
    <h2 className="text-xl font-semibold">Your content</h2>
    {error ? <p role="alert" className="mt-4 text-sm text-goldSoft">{error}</p> : <p className="mt-4 text-sm text-muted">No content yet.</p>}
  </section>;
  return (
    <section
      id={id}
      ref={containerRef}
      className="scroll-mt-20 w-full min-w-0 overflow-hidden"
    >
      {failureNotice}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 overflow-hidden">
          <p className="text-[0.72rem] font-semibold uppercase tracking-[0.14em] text-goldSoft sm:text-xs sm:tracking-[0.18em]">
            {result.id === "sample" ? "Example content pack" : earlier ? "Earlier generation - not the latest request" : "Your content pack"}
          </p>
          {earlier && result.id !== "sample" ? <div data-testid="earlier-generation-source" className="mt-3 text-sm"><p className="font-semibold">Original brief for this earlier draft</p><p className="whitespace-pre-wrap break-words [overflow-wrap:anywhere]">{result.source}</p></div> : null}
          <h2 className="mt-2 line-clamp-2 font-display text-[1.7rem] uppercase leading-none tracking-normal text-bone sm:truncate sm:text-2xl">
            {result.title}
          </h2>
          <p className="mt-3 break-words text-sm leading-6 text-muted sm:mt-2">{result.summary}</p>
          {result.id !== "sample" ? <p className="mt-2 text-xs text-muted">{result.sections.every(s => s.review?.status === "ready_to_review" && s.revisionSource !== "manual") ? "Ready to review" : "Needs confirmation"} · Not independently fact-checked</p> : null}
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
          aria-label={failure ? "Save earlier output" : "Save output"}
        >
          {isSaved ? <BookmarkCheck size={18} /> : <Bookmark size={18} />}
        </button>
      </div>

      {error ? (
        <div role="alert" className="mt-4 rounded border border-gold/40 bg-gold/10 p-3 text-sm leading-6 text-bone">
          {error}
        </div>
      ) : null}

      <details className="mt-4 border-b border-white/10 pb-3">
      <summary className="cursor-pointer text-sm text-muted">Formats & filters</summary>
      {!isPending && result.id !== "sample" && result.sections.length ? <GenerationSummary sections={result.sections} /> : null}
      <div className="studio-scroll mt-3 flex snap-x scroll-px-4 gap-2 overflow-x-auto pb-2">
        {filters.map((filter) => (
          <button
            key={filter.id}
            type="button"
            onClick={() => onFilterChange(filter.id)}
            aria-pressed={activeFilter === filter.id}
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
      </details>

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
              onEdit={onEditSection}
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
        Regenerate
      </button>
      <button type="button" onClick={onUndo} disabled={!canUndo || isPending} className="mt-3 flex min-h-10 items-center gap-2 text-sm text-muted disabled:opacity-40" title="Undo last content edit"><Undo2 size={16} />Undo edit</button>
      <div className="mt-3 grid gap-2 sm:mt-2 sm:grid-cols-3">
        <button
          type="button"
          onClick={onCopyAll}
          className="flex min-h-11 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.035] px-4 text-sm font-semibold text-bone transition hover:border-violet/60 sm:rounded"
        >
          <Copy size={16} />
          {copiedId === "all" ? "Copied" : failure ? "Copy earlier draft" : "Copy all"}
        </button>
        <button
          type="button"
          onClick={onDownload}
          className="flex min-h-11 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.035] px-4 text-sm font-semibold text-bone transition hover:border-violet/60 sm:rounded"
        >
          <FileText size={16} />
          {failure ? "Export earlier draft .txt" : "Download .txt"}
        </button>
        <button
          type="button"
          onClick={onSaveCurrent}
          className="flex min-h-11 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.035] px-4 text-sm font-semibold text-bone transition hover:border-gold/60 sm:rounded"
        >
          <Bookmark size={16} />
          {failure ? "Save earlier draft" : "Save all"}
        </button>
      </div>
    </section>
  );
}

function GenerationSummary({ sections }: { sections: GeneratedSection[] }) {
  const labels = Array.from(new Set(sections.map((section) => labelForContentType(section.type))));

  return (
    <div className="mt-4 rounded-xl border border-violet/30 bg-violet/[0.08] p-3 sm:rounded">
      <div className="flex flex-wrap gap-2">
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
  onEdit,
  onCopyRefinement
}: {
  section: GeneratedSection;
  sourceText: string;
  copied: boolean;
  plan: PlanId;
  image?: GeneratedImage;
  onCopy: () => void;
  onGenerateImage: () => void;
  onEdit: (section: GeneratedSection) => void;
  onCopyRefinement: (action: string) => void;
}) {
  const canGenerateImage = plan === "pro_studio";
  const formattedOutput = formatOutputSection(section, sourceText);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(section);
  const [refinement, setRefinement] = useState("");

  return (
    <article data-content-editing={editing} className="w-full min-w-0 overflow-hidden rounded border border-white/[0.08] bg-ink/58 p-4 shadow-[0_16px_45px_rgba(0,0,0,0.22)] sm:border-white/10 sm:bg-white/[0.035] sm:p-4 sm:shadow-none">
      <div className="mb-4 flex flex-col gap-3 sm:mb-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 overflow-hidden">
          <p className="text-[0.72rem] uppercase tracking-[0.14em] text-violet sm:text-xs sm:tracking-[0.18em]">
            {section.platform}
          </p>
          <h3 className="mt-2 break-words text-xl font-semibold leading-6 text-bone sm:mt-1 sm:text-lg">{section.title}</h3>
          {section.revisionSource && <p className="mt-1 text-xs text-muted">{section.revisionSource === "manual" ? "Manually edited" : "AI refined"}</p>}
        </div>
        <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:shrink-0 sm:flex-wrap">
          {isImageContentType(section.type) && <button
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
            Create Image
          </button>}
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

      <div className="mb-3 text-sm" role="status">
        <p className={section.review?.status === "ready_to_review" && section.revisionSource !== "manual" ? "text-muted" : "font-semibold text-goldSoft"}>{section.review?.status === "ready_to_review" && section.revisionSource !== "manual" ? "Ready to review" : "Needs confirmation"}</p>
        {(section.review?.notes ?? []).map(note => <p key={note} className="mt-1 text-xs leading-5 text-muted">{note}</p>)}
      </div>
      {editing ? <div className="grid gap-3">
        <label className="grid gap-2 text-sm">Body<textarea aria-label={`Edit ${section.title} body`} rows={10} maxLength={20000} value={draft.body} onChange={e => setDraft({ ...draft, body: e.target.value })} className="w-full rounded border border-white/20 bg-ink p-3 leading-7" /></label>
        <label className="grid gap-2 text-sm">Items, one per line<textarea rows={4} maxLength={20000} value={draft.items.join("\n")} onChange={e => setDraft({ ...draft, items: e.target.value.split("\n") })} className="w-full rounded border border-white/20 bg-ink p-3" /></label>
        <label className="grid gap-2 text-sm">Call to action<input maxLength={2000} value={draft.cta ?? ""} onChange={e => setDraft({ ...draft, cta: e.target.value })} className="min-h-11 rounded border border-white/20 bg-ink px-3" /></label>
        <div className="flex gap-3">
          <button className="flex min-h-11 items-center gap-2 rounded bg-violet px-4 text-sm" onClick={() => { onEdit({ ...draft, items: draft.items.filter(Boolean) }); setEditing(false); }}><Check size={16} />Apply edits</button>
          <button className="min-h-11 px-3 text-sm text-muted" onClick={() => setEditing(false)}>Cancel</button>
        </div>
      </div> : socialPostTypes.has(section.type)
        ? <p data-testid="post-caption" className="whitespace-pre-wrap break-words text-[0.95rem] leading-7 text-bone/92">{formatSectionPlainText(section, sourceText)}</p>
        : <PlatformOutputBlocks blocks={formattedOutput.blocks} />}

      {image ? (
        <div className="mt-4 rounded-xl border border-gold/30 bg-ink/55 p-3 sm:rounded">
          <img
            src={image.image}
            alt={`Generated visual for ${section.title}`}
            className="w-full rounded border border-white/10 object-contain"
            style={{ aspectRatio: image.format === "landscape" ? "16 / 9" : image.format === "portrait" ? "4 / 5" : image.format === "vertical" ? "9 / 16" : "1" }}
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

      <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-white/10 pt-3">
        <button type="button" onClick={() => { setDraft(section); setEditing(true); }} disabled={editing} className="flex min-h-11 items-center gap-2 rounded border border-white/20 px-3 text-sm"><PenLine size={15} />Edit</button>
        <button type="button" disabled={editing} onClick={() => onCopyRefinement("alternative")} className="flex min-h-11 items-center gap-2 rounded border border-white/20 px-3 text-sm"><RefreshCcw size={15} />Regenerate</button>
      </div>
      <form className="mt-3 grid gap-2" onSubmit={e => { e.preventDefault(); if (refinement.trim() && !editing) onCopyRefinement(refinement.trim()); }}>
        <label className="grid gap-2 text-sm">What would you like to change?<input value={refinement} maxLength={400} onChange={e => setRefinement(e.target.value)} placeholder="Make it shorter and more conversational." className="min-h-11 min-w-0 rounded border border-white/20 bg-ink px-3 text-sm" /></label>
        <div className="flex flex-wrap items-center gap-2"><button type="submit" disabled={editing || !refinement.trim()} className="flex min-h-11 items-center gap-2 rounded border border-violet/60 px-3 text-sm disabled:opacity-40"><Sparkles size={14} />Apply change</button><span className="text-xs text-muted">1 generation</span></div>
        <details><summary className="cursor-pointer text-xs text-muted">Quick changes</summary>
        <select aria-label={`Refine ${section.title}`} value={Object.hasOwn(REFINEMENT_ACTIONS, refinement) ? refinement : ""} onChange={e => setRefinement(e.target.value)} className="mt-2 min-h-11 min-w-0 rounded border border-white/20 bg-ink px-2 text-xs">
          <option value="" disabled>Choose a change</option>
          {Object.entries({ shorten: "Make shorter", expand: "Make longer", simplify: "Simplify", professional: "More professional", conversational: "More conversational", hook: "Strengthen hook", cta: "Improve CTA", alternative: "Create alternative" }).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
        </details>
      </form>
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
              className="grid min-w-0 grid-cols-[2rem_minmax(0,1fr)] gap-3 border-b border-white/10 py-3 text-sm leading-6 text-bone/90"
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
      <div className="min-w-0">
        <span className="sr-only">{block.label}</span>
        <p className="whitespace-pre-wrap break-words text-sm text-muted">{block.lines.join(block.separator ?? " ")}</p>
      </div>
    );
  }

  if (block.kind === "platform") {
    return (
      <div className="min-w-0 border-b border-white/10 py-3">
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
      <div className="min-w-0 text-sm leading-6 text-bone">
        <span className="sr-only">{block.label}</span>
        <div className="mt-2 grid min-w-0 gap-2">
          {block.lines.map((line) => (
            <p key={line} className="min-w-0 whitespace-pre-wrap break-words text-[0.98rem] font-semibold leading-7 text-bone">
              {line}
            </p>
          ))}
        </div>
      </div>
    );
  }

  if (block.kind === "cta" || block.kind === "preview") {
    return (
      <div className="min-w-0 text-sm leading-6 text-bone">
        <span className="sr-only">{block.label}</span>
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

type ImageStudioControls = {
  appearance: ImageAppearance; onAppearance: (value: ImageAppearance) => void;
  mode: ImageMode; instructions: string; source: string; industry: string; platform: string;
  onMode: (mode: ImageMode) => void; onInstructions: (value: string) => void;
  onSource: (value: string) => void; onIndustry: (value: string) => void; onPlatform: (value: string) => void;
  onEdit: (design: ImageDesign) => void; onUndo: () => void; canUndo: boolean;
  saved: Record<string, GeneratedImage>; onOpenSaved: (id: string) => void;
};
function ImageGenerationPanel({
  studio,
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
  studio: ImageStudioControls;
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
  const dialogRef = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (section && !dialog.open) dialog.showModal();
    if (!section && dialog.open) dialog.close();
  }, [section]);

  const isProStudio = plan === "pro_studio";
  const selectedMode = buildCreativeBrief({ appearance: studio.appearance, mode: studio.mode, creativeInstructions: studio.instructions, outputText: studio.source || studio.instructions,
    platform: studio.platform, contentType: section?.type ?? "", style, format, brandContext: { visualStyle, brandColors } }).design.mode;

  return (
    <dialog ref={dialogRef} aria-labelledby="image-generation-title" onCancel={onClose} onClose={onClose}
      className="fixed inset-0 m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%_-_2rem)] max-w-5xl overflow-y-auto overscroll-contain rounded border border-white/10 bg-coal p-4 text-bone shadow-violet backdrop:bg-black/70 backdrop:backdrop-blur-sm sm:p-5"
    >
      {section ? <div className="min-w-0">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-goldSoft">
              {studio.platform}
            </p>
            <h2 id="image-generation-title" className="mt-2 font-display text-2xl uppercase tracking-normal text-bone">
              Image Studio
            </h2>
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
          <div className="mt-5 grid items-start gap-6 md:grid-cols-2">
            <div className="grid min-w-0 gap-4">
              <label className="grid gap-2 text-sm font-semibold">What image would you like?
                <textarea rows={3} maxLength={600} value={studio.instructions} disabled={isPending} onChange={e => studio.onInstructions(e.target.value)} placeholder="Create a luxury cream-and-gold giveaway graphic for Gorl Lead." className="rounded border border-white/20 bg-ink p-3 leading-7" />
              </label>
              <ImageChoices value={studio.appearance} onChange={studio.onAppearance} format={format} onFormat={onFormatChange} disabled={isPending} brandColors={brandColors} />
              <p aria-live="polite" className="text-xs text-muted">{selectedMode === "text" ? "Text design · No AI image credit" : `${selectedMode === "mixed" ? "Text + Image" : "Image"} · 1 AI image credit on success`}</p>
              <details className="border-y border-white/10 py-3">
              <summary className="cursor-pointer text-sm font-semibold">Advanced Options (Optional)</summary>
              <div className="mt-4 grid gap-4">
              <div role="group" aria-label="Visual mode" className="grid grid-cols-4 gap-1 rounded border border-white/15 p-1">
                {IMAGE_MODES.map(mode => <button key={mode} type="button" aria-pressed={studio.mode === mode} disabled={isPending}
                  onClick={() => studio.onMode(mode)} className={clsx("min-h-11 rounded px-1 text-sm", studio.mode === mode ? "bg-violet text-white" : "text-muted hover:bg-white/10")}>
                  {{ auto: "Auto", image: "Image", text: "Text", mixed: "Text + Image" }[mode]}
                </button>)}
              </div>
              <label className="grid gap-2 text-sm">Source caption / graphic text
                <textarea aria-label="Image content" rows={3} maxLength={2600} value={studio.source} disabled={isPending} onChange={e => studio.onSource(e.target.value)} className="rounded border border-white/15 bg-ink p-3" />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="grid gap-2 text-sm">Platform<select aria-label="Image platform" value={studio.platform} disabled={isPending} onChange={e => studio.onPlatform(e.target.value)} className="min-h-11 min-w-0 rounded border border-white/15 bg-ink px-3">
                  {[...new Set([studio.platform, "LinkedIn", "Instagram", "Facebook", "TikTok", "YouTube", "X", "Pinterest", "Blog"])].map(p => <option key={p}>{p}</option>)}
                </select></label>
                <label className="grid gap-2 text-sm">Industry / niche<input value={studio.industry} maxLength={180} disabled={isPending} onChange={e => studio.onIndustry(e.target.value)} className="min-h-11 min-w-0 rounded border border-white/15 bg-ink px-3" /></label>
              </div>
              <label className="grid gap-2 text-sm">Fallback template<select value={style} disabled={isPending} onChange={e => onStyleChange(e.target.value as ImageStyle)} className="min-h-11 rounded border border-white/15 bg-ink px-3">
                {imageStyles.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}
              </select></label>

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="grid gap-2">
                  <span className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">
                    Brand colours
                  </span>
                  <input
                    value={brandColors}
                    maxLength={180}
                    disabled={isPending}
                    onChange={(event) => onBrandColorsChange(event.target.value)}
                    className="min-h-11 rounded border border-white/10 bg-ink/70 px-3 text-sm text-bone outline-none transition placeholder:text-muted focus:border-violet/70"
                    placeholder="White, teal or #ffffff, #087e83"
                  />
                </label>
                <label className="grid gap-2">
                  <span className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">
                    Visual direction
                  </span>
                  <input
                    value={visualStyle}
                    maxLength={180}
                    disabled={isPending}
                    onChange={(event) => onVisualStyleChange(event.target.value)}
                    className="min-h-11 rounded border border-white/10 bg-ink/70 px-3 text-sm text-bone outline-none transition placeholder:text-muted focus:border-violet/70"
                    placeholder="Editorial photography, hand-drawn illustration"
                  />
                </label>
              </div>
              </div>
              </details>
            </div>

            <div className="min-w-0 md:sticky md:top-0">
            {error ? (
              <div role="alert" className="mt-4 rounded border border-gold/40 bg-gold/10 p-3 text-sm leading-6 text-bone">
                {error}
              </div>
            ) : null}

            {image ? (
              <div>
                <img
                  src={image.image}
                  alt={`Generated visual for ${section.title}`}
                  className="max-h-[55vh] w-full rounded border border-white/10 object-contain"
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
                  <span>{image.size || image.format}</span>
                  <span>Saved on this device</span>
                </div>
                {image.design && image.design.mode !== "image" ? <ImageDesignEditor key={`${section.id}:${image.createdAt}`} design={image.design} disabled={isPending} canUndo={studio.canUndo} onApply={studio.onEdit} onUndo={studio.onUndo} /> : null}
                {image.warning ? (
                  <p className="mt-2 text-xs leading-5 text-goldSoft">{image.warning}</p>
                ) : null}
              </div>
            ) : null}

            {!image ? (
              <button
                type="button"
                onClick={onGenerate}
                disabled={isPending || !(studio.source.trim() || studio.instructions.trim())}
                className="mt-5 flex min-h-12 w-full items-center justify-center gap-2 rounded border border-violet/70 bg-violet px-4 text-sm font-semibold text-white shadow-violet transition hover:bg-violetDeep disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-muted"
              >
                {isPending ? <Loader2 className="animate-spin" size={17} /> : <Wand2 size={17} />}
                {isPending ? "Generating visual..." : "Generate visual"}
              </button>
            ) : null}
            {Object.keys(studio.saved).length > 0 ? <div className="mt-5 border-t border-white/10 pt-3">
              <h3 className="text-sm text-muted">Recent designs on this device</h3>
              <div className="mt-2 grid grid-cols-4 gap-2">{Object.entries(studio.saved).slice(-8).map(([id, saved]) => <button key={id} type="button" disabled={isPending} aria-label={`Open saved design ${saved.design?.headline || id}`} onClick={() => studio.onOpenSaved(id)} className="aspect-square overflow-hidden rounded border border-white/15 hover:border-violet"><img src={saved.image} alt="" className="h-full w-full object-contain" /></button>)}</div>
            </div> : null}
            </div>
          </div>
        )}
      </div> : null}
    </dialog>
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
  onOpen,
  onDelete
}: {
  store: StudioStore;
  plan: PlanId;
  copiedId: string;
  onPlanChange: (value: PlanId) => void;
  onCopy: (value: GenerationResult) => void;
  onOpen: (value: GenerationResult) => void;
  onDelete: (id: string) => void;
}) {
  const [platformFilter, setPlatformFilter] = useState<FilterId>("all");
  const [categoryFilter, setCategoryFilter] = useState<PresetTopicId>("none");
  const [query, setQuery] = useState("");
  const isPro = plan !== "free";

  const filtered = store.saved.filter((item) => {
    const matchesCategory =
      categoryFilter === "none" || item.presetTopic === categoryFilter;
    const matchesPlatform =
      platformFilter === "all" ||
      item.sections.some((section) => sectionMatchesFilter(section, platformFilter));

    const searchable = `${item.title} ${item.source} ${item.sections.map(s => `${s.body} ${s.items.join(" ")}`).join(" ")}`.toLowerCase();
    return matchesCategory && matchesPlatform && searchable.includes(query.trim().toLowerCase());
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
            Your saved content packs.
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
          Saved history is included in paid plans. Your drafts and recent work remain available in the workspace.
        </div>
      ) : (
        <>
          <label className="mb-3 grid gap-2 text-sm">Search my content<input value={query} onChange={e => setQuery(e.target.value)} type="search" placeholder="Title, topic, or phrase" className="min-h-11 rounded border border-white/20 bg-ink px-3" /></label>
          <div className="grid gap-3 sm:grid-cols-2">
            <select
              aria-label="Filter saved content by platform"
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
              aria-label="Filter saved content by category"
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
                        <button type="button" onClick={() => onOpen(item)} className="text-left hover:underline">{item.title}</button>
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
  const dialogRef = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (isOpen && !dialog.open) dialog.showModal();
    if (!isOpen && dialog.open) dialog.close();
  }, [isOpen]);

  return (
      <dialog ref={dialogRef} aria-label="Recent work" onCancel={onClose} onClose={onClose}
        className="fixed inset-y-0 left-auto right-0 m-0 h-dvh max-h-dvh w-full max-w-md border-l border-white/10 bg-coal p-4 text-bone backdrop:bg-black/60"
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
            className="grid h-10 w-10 place-items-center border border-white/10 bg-white/[0.04] text-muted"
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
      </dialog>
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
  canSave,
  earlierResult,
  onGenerate,
  onSave,
  onSaveDraft,
  onOpenHistory
}: {
  canGenerate: boolean;
  isPending: boolean;
  saved: boolean;
  canSave: boolean;
  earlierResult: boolean;
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
          disabled={!canSave}
          className="flex min-h-12 flex-col items-center justify-center gap-1 rounded-xl border border-white/10 bg-white/[0.025] text-[0.7rem] font-semibold text-bone"
        >
          {saved ? <BookmarkCheck size={17} /> : <Bookmark size={17} />}
          {earlierResult ? "Save earlier" : "Save"}
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
