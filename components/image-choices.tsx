"use client";
import { useState } from "react";
import { Check, Plus } from "lucide-react";
import { COLOUR_SWATCHES, normalizeHex, VISUAL_STYLES, VISUAL_TYPES, type ImageAppearance } from "@/lib/image-appearance";
import type { SocialImageFormat } from "@/lib/social-image";

const field = "min-h-11 min-w-0 rounded border border-white/20 bg-ink px-3 text-sm";
export function ImageChoices({ value, onChange, format, onFormat, disabled, brandColors }: {
  value: ImageAppearance; onChange: (value: ImageAppearance) => void;
  format: SocialImageFormat; onFormat: (value: SocialImageFormat) => void;
  disabled: boolean; brandColors: string;
}) {
  const [hex, setHex] = useState("");
  const validHex = normalizeHex(hex.trim());
  const selectColour = (colour: string) => onChange({ ...value, colours: value.colours.includes(colour) ? value.colours.filter(c => c !== colour) : [...value.colours.slice(-1), colour] });
  return <fieldset disabled={disabled} className="grid min-w-0 gap-4">
    <label className="grid gap-2 text-sm">Image type<select aria-label="Image type" className={field} value={value.type} onChange={e => onChange({ ...value, type: e.target.value as ImageAppearance["type"] })}>
      {VISUAL_TYPES.map(t => <option key={t} value={t}>{{ auto: "Let AI decide", graphic: "Graphic", photograph: "Photograph", illustration: "Illustration" }[t]}</option>)}
    </select></label>
    <fieldset><legend className="mb-2 text-sm">Colours</legend>
      <div className="flex flex-wrap gap-2">{COLOUR_SWATCHES.map(c => <button key={c.name} type="button" title={c.name} aria-label={c.name} aria-pressed={value.colours.includes(c.hex)} onClick={() => selectColour(c.hex)} className="grid h-11 w-11 place-items-center rounded border border-white/30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-violet" style={{ backgroundColor: c.hex }}>
        {value.colours.includes(c.hex) ? <Check size={20} className="rounded bg-black/80 text-white" /> : null}
      </button>)}</div>
      <div className="mt-3 flex items-end gap-2"><label className="grid min-w-0 flex-1 gap-2 text-sm">Custom HEX<input className={field} value={hex} maxLength={7} placeholder="#fff7e8" aria-invalid={Boolean(hex && !validHex)} onChange={e => setHex(e.target.value)} /></label>
        <button type="button" disabled={!validHex} title="Add custom colour" aria-label="Add custom colour" onClick={() => { if (validHex) { selectColour(validHex); setHex(""); } }} className="grid h-11 w-11 place-items-center rounded border border-white/20 disabled:opacity-40"><Plus size={18} /></button>
      </div>
      {hex && !validHex ? <p role="status" className="mt-2 text-xs text-goldSoft">Use #RGB or #RRGGBB.</p> : null}
      <div className="mt-2 flex flex-wrap items-center gap-2">{value.colours.map((c, i) => <button type="button" key={c} title={`Remove ${c}`} aria-label={`Remove ${c}`} onClick={() => selectColour(c)} className="flex min-h-11 items-center gap-2 text-xs"><span className="h-5 w-5 rounded border border-white/30" style={{ backgroundColor: c }} />{i === 0 ? "Background" : "Accent"}: {c}</button>)}</div>
      <button type="button" onClick={() => onChange({ ...value, colours: [] })} className="min-h-11 text-sm text-muted underline underline-offset-4">{brandColors ? "Use saved brand colours" : "Automatic colours"}</button>
    </fieldset>
    <div className="grid gap-3 sm:grid-cols-2">
      <label className="grid gap-2 text-sm">Style<select aria-label="Style" className={field} value={value.style} onChange={e => onChange({ ...value, style: e.target.value as ImageAppearance["style"] })}>{VISUAL_STYLES.map(s => <option key={s} value={s}>{s === "auto" ? "Automatic" : s[0].toUpperCase() + s.slice(1)}</option>)}</select></label>
      <label className="grid gap-2 text-sm">Format<select aria-label="Format" className={field} value={format} onChange={e => onFormat(e.target.value as SocialImageFormat)}>
        <option value="square">Instagram square · 1:1</option><option value="portrait">Instagram portrait · 4:5</option><option value="vertical">Story / Reel · 9:16</option><option value="landscape">YouTube / LinkedIn · 16:9</option>
      </select></label>
    </div>
  </fieldset>;
}
