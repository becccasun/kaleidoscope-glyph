import { create } from "zustand";
import { persist } from "zustand/middleware";
import { randomSeed } from "./geometry";

export interface GlyphState {
  seed: number;
  filled: number[];
}

export const DEFAULT_CHARS = [
  ..."ABCDEFGHIJKLMNOPQRSTUVWXYZ",
  ..."0123456789",
];

interface FontStore {
  fontName: string;
  symmetry: number;
  density: number;
  chars: string[];
  glyphs: Record<string, GlyphState>;
  current: string;

  setFontName: (name: string) => void;
  setSymmetry: (n: number) => void;
  setDensity: (n: number) => void;
  select: (char: string) => void;
  addChar: (char: string) => void;
  removeChar: (char: string) => void;
  spin: () => void;
  spinAll: () => void;
  clearGlyph: () => void;
  setCell: (index: number, on: boolean) => void;
  setCells: (indices: number[], on: boolean) => void;
  reset: () => void;
}

const freshGlyph = (): GlyphState => ({ seed: randomSeed(), filled: [] });

const initialGlyphs = () =>
  Object.fromEntries(DEFAULT_CHARS.map((c) => [c, freshGlyph()]));

export const useFontStore = create<FontStore>()(
  persist(
    (set, get) => ({
      fontName: "Kaleidoscope",
      symmetry: 8,
      density: 7,
      chars: DEFAULT_CHARS,
      glyphs: initialGlyphs(),
      current: "A",

      setFontName: (fontName) => set({ fontName }),
      // Changing the partition invalidates every fill; make that explicit.
      setSymmetry: (symmetry) =>
        set((s) => ({ symmetry, glyphs: mapGlyphs(s.glyphs, (g) => ({ ...g, filled: [] })) })),
      setDensity: (density) =>
        set((s) => ({ density, glyphs: mapGlyphs(s.glyphs, (g) => ({ ...g, filled: [] })) })),

      select: (current) => set({ current }),
      addChar: (raw) => {
        const char = [...raw.trim()][0];
        if (!char) return;
        const { chars, glyphs } = get();
        if (chars.includes(char)) return set({ current: char });
        set({
          chars: [...chars, char],
          glyphs: { ...glyphs, [char]: freshGlyph() },
          current: char,
        });
      },
      removeChar: (char) => {
        if (DEFAULT_CHARS.includes(char)) return;
        const { chars, glyphs, current } = get();
        const rest = { ...glyphs };
        delete rest[char];
        set({
          chars: chars.filter((c) => c !== char),
          glyphs: rest,
          current: current === char ? "A" : current,
        });
      },

      spin: () =>
        set((s) => ({ glyphs: { ...s.glyphs, [s.current]: freshGlyph() } })),
      spinAll: () =>
        set((s) => ({ glyphs: mapGlyphs(s.glyphs, () => freshGlyph()) })),
      clearGlyph: () =>
        set((s) => ({
          glyphs: { ...s.glyphs, [s.current]: { ...s.glyphs[s.current], filled: [] } },
        })),

      setCell: (index, on) => get().setCells([index], on),
      setCells: (indices, on) =>
        set((s) => {
          const g = s.glyphs[s.current];
          const next = new Set(g.filled);
          for (const i of indices) {
            if (on) next.add(i);
            else next.delete(i);
          }
          if (next.size === g.filled.length && indices.every((i) => on === g.filled.includes(i))) {
            return s;
          }
          return { glyphs: { ...s.glyphs, [s.current]: { ...g, filled: [...next].sort((a, b) => a - b) } } };
        }),

      reset: () =>
        set({ chars: DEFAULT_CHARS, glyphs: initialGlyphs(), current: "A" }),
    }),
    { name: "kaleidoscope-font-v1" },
  ),
);

function mapGlyphs(
  glyphs: Record<string, GlyphState>,
  fn: (g: GlyphState) => GlyphState,
): Record<string, GlyphState> {
  return Object.fromEntries(Object.entries(glyphs).map(([k, g]) => [k, fn(g)]));
}
