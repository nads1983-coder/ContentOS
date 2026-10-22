"use client";

import { useState } from "react";
import { Undo2, Check } from "lucide-react";
import type { ImageDesign } from "@/lib/image-design";

export function ImageDesignEditor({ design, disabled, canUndo, onApply, onUndo }: {
  design: ImageDesign; disabled: boolean; canUndo: boolean;
  onApply: (design: ImageDesign) => void; onUndo: () => void;
}) {
  const [draft, setDraft] = useState(design);
  const field = "min-h-11 min-w-0 rounded border border-white/15 bg-ink px-3";
  return <fieldset disabled={disabled} className="mt-4 grid gap-3 border-t border-white/10 pt-4">
    <legend className="text-sm">Edit design</legend>
    <label className="grid gap-1 text-sm">Headline<input maxLength={68} value={draft.headline} onChange={e => setDraft({ ...draft, headline: e.target.value })} className={field} /></label>
    <label className="grid gap-1 text-sm">Supporting text<textarea maxLength={120} rows={2} value={draft.body} onChange={e => setDraft({ ...draft, body: e.target.value })} className={`${field} py-2`} /></label>
    <div className="flex flex-wrap items-end gap-3">
      <label className="grid gap-1 text-xs">Background<input type="color" value={draft.background} onChange={e => setDraft({ ...draft, background: e.target.value })} className="h-11 w-12 bg-transparent" /></label>
      <label className="grid gap-1 text-xs">Accent<input type="color" value={draft.accent} onChange={e => setDraft({ ...draft, accent: e.target.value })} className="h-11 w-12 bg-transparent" /></label>
      <label className="grid gap-1 text-xs">Alignment<select value={draft.align} onChange={e => setDraft({ ...draft, align: e.target.value as ImageDesign["align"] })} className={field}><option value="left">Left</option><option value="center">Centre</option></select></label>
      <label className="grid gap-1 text-xs">Font<select value={draft.font} onChange={e => setDraft({ ...draft, font: e.target.value as ImageDesign["font"] })} className={field}><option value="sans">Modern</option><option value="editorial">Editorial</option></select></label>
    </div>
    <div className="flex gap-2">
      <button type="button" onClick={() => onApply(draft)} className="flex min-h-11 items-center gap-2 rounded border border-white/15 px-3 text-sm"><Check size={16} /> Apply edits</button>
      <button type="button" title="Undo design edit" aria-label="Undo design edit" disabled={!canUndo} onClick={onUndo} className="grid h-11 w-11 place-items-center rounded border border-white/15 disabled:opacity-40"><Undo2 size={16} /></button>
    </div>
  </fieldset>;
}
