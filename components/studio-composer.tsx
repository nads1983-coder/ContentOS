"use client";

import { Check, Loader2, Lock, Save, Wand2 } from "lucide-react";
import { contentTypes, ctaModes, tones, sharpnessModes, presetTopics } from "@/lib/content-config";
import type { ContentTypeId, CtaModeId, ToneId, SharpnessId, PresetTopicId } from "@/types/content";
import type { PlanId, UsageSummary, BrandProfile } from "@/types/saas";

type Props = {
  id: string; source: string; tone: ToneId; lastUsedTone: ToneId | null;
  sharpness: SharpnessId; ctaMode: CtaModeId; presetTopic: PresetTopicId;
  selectedTypes: ContentTypeId[]; brandName: string; audience: string; offer: string;
  writingStyle: string; contentGoal: string; plan: PlanId; usage: UsageSummary;
  length: "short" | "standard" | "detailed";
  onLengthChange: (v: "short" | "standard" | "detailed") => void;
  canGenerate: boolean; isPending: boolean; isLoading: boolean; brandProfiles: BrandProfile[];
  onSelectBrand: (brand: BrandProfile) => void;
  onSourceChange: (v: string) => void; onBrandNameChange: (v: string) => void;
  onAudienceChange: (v: string) => void; onOfferChange: (v: string) => void;
  onWritingStyleChange: (v: string) => void; onContentGoalChange: (v: string) => void;
  onToneChange: (v: ToneId) => void; onSharpnessChange: (v: SharpnessId) => void;
  onCtaModeChange: (v: CtaModeId) => void; onPresetTopicChange: (v: PresetTopicId) => void;
  onToggleType: (v: ContentTypeId) => void; onGenerate: () => void; onSaveDraft: () => void;
};
const field = "min-h-11 w-full rounded border border-white/20 bg-ink px-3 py-2 text-sm text-bone outline-none focus-visible:ring-2 focus-visible:ring-violet";

export function StudioComposer(p: Props) {
  return (
    <fieldset id={p.id} disabled={p.isLoading || p.isPending} aria-busy={p.isLoading || p.isPending} className="scroll-mt-20 min-w-0 border-b border-white/10 pb-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">AI Studio</h1>
        <span className="text-xs text-muted">{p.usage.remaining} / {p.usage.limit} generations remaining</span>
      </div>
      <label htmlFor="studio-source" className="mt-6 block text-sm font-semibold">What would you like to create?</label>
      <textarea id="studio-source" value={p.source} onChange={e => p.onSourceChange(e.target.value)}
        rows={6} maxLength={8000} className={`${field} mt-2 resize-y leading-7`}
        placeholder="An idea, rough notes, existing content, or a video transcript..." />
      <div className="mt-1 text-right text-xs text-muted">{p.source.length.toLocaleString()} / 8,000</div>

      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" onClick={p.onGenerate} disabled={!p.canGenerate} className="flex min-h-12 flex-1 items-center justify-center gap-2 rounded bg-violet px-4 text-sm font-semibold text-white hover:bg-violetDeep disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-muted">
          {p.isPending ? <Loader2 size={18} className="animate-spin" /> : <Wand2 size={18} />}
          {p.isLoading ? "Loading your workspace..." : p.isPending ? "Creating your content..." : "Generate content pack"}
        </button>
        <button type="button" onClick={p.onSaveDraft} title="Save draft" aria-label="Save draft" className="grid h-12 w-12 place-items-center rounded border border-white/20 hover:bg-white/10"><Save size={18} /></button>
      </div>
      {p.selectedTypes.length === 0 ? <p role="status" className="mt-2 text-sm text-muted">Select at least one content format.</p> : null}
      {p.isPending ? <p role="status" className="mt-3 flex items-center gap-2 text-xs text-muted"><Check size={14} /> Preparing {p.selectedTypes.length} platform-specific outputs</p> : null}

      <fieldset className="mt-4">
        <legend className="mb-2 text-sm font-semibold">Create content for</legend>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {contentTypes.map(type => {
            const locked = Boolean(type.paidOnly && p.plan === "free");
            const checked = p.selectedTypes.includes(type.id);
            return <label key={type.id} className={`flex min-h-11 cursor-pointer items-center gap-2 rounded border px-3 py-2 text-xs ${checked ? "border-violet bg-violet/10 text-white" : "border-white/15 text-muted"} ${locked ? "opacity-70" : ""}`}>
              <input type="checkbox" checked={checked} disabled={locked || p.isPending} onChange={() => p.onToggleType(type.id)} className="h-4 w-4 shrink-0 accent-violet" />
              <span className="min-w-0">{type.shortLabel}{locked ? <span className="sr-only">, paid plan required</span> : null}</span>
              {locked ? <Lock size={12} className="ml-auto shrink-0" aria-hidden /> : null}
            </label>;
          })}
        </div>
      </fieldset>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <label className="grid gap-2 text-sm">Objective
          <input className={field} value={p.contentGoal} maxLength={180} onChange={e => p.onContentGoalChange(e.target.value)} placeholder="Educate, start a conversation, announce..." />
        </label>
        <label className="grid gap-2 text-sm">Tone
          <select className={field} value={p.tone} onChange={e => p.onToneChange(e.target.value as ToneId)}>
            {tones.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
          </select>
        </label>
      </div>

      <details className="mt-5 border-y border-white/10 py-4">
        <summary className="cursor-pointer text-sm font-semibold">Brand voice & audience{p.brandName ? `: ${p.brandName}` : ""}</summary>
        {p.brandProfiles.length ? <label className="mt-4 grid gap-2 text-sm">Saved brand
          <select defaultValue="" className={field} onChange={e => { const brand = p.brandProfiles.find(b => b.id === e.target.value); if (brand) p.onSelectBrand(brand); }}>
            <option value="">Choose a saved brand</option>
            {p.brandProfiles.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </label> : null}
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {[
            { label: "Brand name", value: p.brandName, change: p.onBrandNameChange, max: 180 },
            { label: "Target audience", value: p.audience, change: p.onAudienceChange, max: 240 },
            { label: "Offer", value: p.offer, change: p.onOfferChange, max: 240 }
          ].map(f => <label key={f.label} className="grid gap-2 text-sm">{f.label}<input className={field} value={f.value} maxLength={f.max} onChange={e => f.change(e.target.value)} /></label>)}
        </div>
        <label className="mt-3 grid gap-2 text-sm">Voice preferences
          <textarea className={field} rows={4} value={p.writingStyle} maxLength={320} onChange={e => p.onWritingStyleChange(e.target.value)} placeholder="Style, values, preferred words, phrases to avoid, typical calls to action..." />
        </label>
      </details>
      <details className="border-b border-white/10 py-4">
        <summary className="cursor-pointer text-sm font-semibold">Advanced options</summary>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="grid gap-2 text-sm">Length<select className={field} value={p.length} onChange={e => p.onLengthChange(e.target.value as Props["length"])}><option value="short">Short</option><option value="standard">Standard</option><option value="detailed">Detailed</option></select></label>
          <label className="grid gap-2 text-sm">Topic<select className={field} value={p.presetTopic} onChange={e => p.onPresetTopicChange(e.target.value as PresetTopicId)}>{presetTopics.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}</select></label>
          <label className="grid gap-2 text-sm">Directness<select className={field} value={p.sharpness} onChange={e => p.onSharpnessChange(e.target.value as SharpnessId)}>{sharpnessModes.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}</select></label>
          <label className="grid gap-2 text-sm">Call to action<select className={field} value={p.ctaMode} onChange={e => p.onCtaModeChange(e.target.value as CtaModeId)}>{ctaModes.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}</select></label>
        </div>
      </details>
    </fieldset>
  );
}
