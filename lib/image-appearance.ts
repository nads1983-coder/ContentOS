export const VISUAL_TYPES = ["auto", "graphic", "photograph", "illustration"] as const;
export const VISUAL_STYLES = ["auto", "minimalist", "luxury", "bold", "professional", "playful"] as const;
export type ImageAppearance = { type: typeof VISUAL_TYPES[number]; style: typeof VISUAL_STYLES[number]; colours: string[] };
export const DEFAULT_APPEARANCE: ImageAppearance = { type: "auto", style: "auto", colours: [] };
export const COLOUR_SWATCHES = [
  { name: "Green", hex: "#176d51" }, { name: "Blue", hex: "#2356bc" },
  { name: "Red", hex: "#b42a42" }, { name: "Yellow", hex: "#f1d34f" },
  { name: "Purple", hex: "#7450c8" }, { name: "Black", hex: "#111116" },
  { name: "White", hex: "#ffffff" }, { name: "Gold", hex: "#b58a30" }
] as const;
export function normalizeHex(value: string): string | undefined {
  if (!/^#(?:[a-f\d]{3}|[a-f\d]{6})$/i.test(value)) return;
  const lower = value.toLowerCase();
  return lower.length === 4 ? `#${[...lower.slice(1)].map(c => c + c).join("")}` : lower;
}
export function parseImageAppearance(value: unknown): ImageAppearance {
  const v = value as Partial<ImageAppearance> | null;
  if (!v || !VISUAL_TYPES.includes(v.type!) || !VISUAL_STYLES.includes(v.style!) ||
      !Array.isArray(v.colours) || v.colours.length > 2 || !v.colours.every(c => typeof c === "string" && normalizeHex(c))) {
    throw new Error("Choose a supported image type, style and up to two valid HEX colours.");
  }
  return { type: v.type!, style: v.style!, colours: [...new Set(v.colours.map(c => normalizeHex(c)!))] };
}
