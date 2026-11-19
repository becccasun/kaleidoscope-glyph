import { useMemo } from "react";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { randomSeed } from "./geometry";
import { DEFAULT_STYLE, type FillPattern, type GlyphStyle } from "./style";

export interface GlyphState {
  seed: number;
  filled: number[];
}

export const DEFAULT_CHARS = [
  ..."ABCDEFGHIJKLMNOPQRSTUVWXYZ",
  ..."0123456789",
];

/** Everything undo/redo restores. The font name is left to the text field's own undo. */
type Snapshot = Pick<
  FontStore,
  "chars" | "glyphs" | "current" | "symmetry" | "density" | "roundness" | "fill" | "grain"
>;

const HISTORY_LIMIT = 200;
/** Repeated edits with the same key inside this window (a slider drag) collapse into one step. */
const COALESCE_MS = 800;

interface FontStore {
  fontName: string;
  symmetry: number;
  density: number;
  chars: string[];
  glyphs: Record<string, GlyphState>;
  current: string;
  // style — applied at render/export time, so changing it never clears fills
  roundness: number;
  fill: FillPattern;
  grain: number;
  past: Snapshot[];
  future: Snapshot[];

  setFontName: (name: string) => void;
  setSymmetry: (n: number) => void;
  setDensity: (n: number) => void;
  setRoundness: (n: number) => void;
  setFill: (fill: FillPattern) => void;
  setGrain: (n: number) => void;
  select: (char: string) => void;
  addChar: (char: string) => void;
  removeChar: (char: string) => void;
  spin: () => void;
  spinAll: () => void;
  clearGlyph: () => void;
  /** Call once at the start of a paint gesture so the whole stroke undoes as one step. */
  beginStroke: () => void;
  setCell: (index: number, on: boolean) => void;
  setCells: (indices: number[], on: boolean) => void;
  reset: () => void;
  undo: () => void;
  redo: () => void;
}

const freshGlyph = (): GlyphState => ({ seed: randomSeed(), filled: [] });

const initialGlyphs = () =>
  Object.fromEntries(DEFAULT_CHARS.map((c) => [c, freshGlyph()]));

export const useFontStore = create<FontStore>()(
  persist(
    (set, get) => {
      let lastKey = "";
      let lastAt = 0;
      /** Push the pre-edit state onto the undo stack. An empty key never coalesces. */
      const record = (key = "") => {
        const now = Date.now();
        const merge = key !== "" && key === lastKey && now - lastAt < COALESCE_MS;
        lastKey = key;
        lastAt = now;
        if (merge) return;
        const s = get();
        set({ past: [...s.past.slice(1 - HISTORY_LIMIT), snapshot(s)], future: [] });
      };

      return {
        fontName: "My Font #1",
        symmetry: 8,
        density: 7,
        chars: DEFAULT_CHARS,
        glyphs: initialGlyphs(),
        current: "A",
        ...DEFAULT_STYLE,
        past: [],
        future: [],

        setFontName: (fontName) => set({ fontName }),
        setRoundness: (roundness) => {
          record("roundness");
          set({ roundness });
        },
        setFill: (fill) => {
          if (fill === get().fill) return;
          record();
          set({ fill });
        },
        setGrain: (grain) => {
          record("grain");
          set({ grain });
        },
        // Changing the partition invalidates every fill; make that explicit.
        setSymmetry: (symmetry) => {
          record();
          set((s) => ({ symmetry, glyphs: mapGlyphs(s.glyphs, (g) => ({ ...g, filled: [] })) }));
        },
        setDensity: (density) => {
          record("density");
          set((s) => ({ density, glyphs: mapGlyphs(s.glyphs, (g) => ({ ...g, filled: [] })) }));
        },

        select: (current) => set({ current }),
        addChar: (raw) => {
          const char = [...raw.trim()][0];
          if (!char) return;
          const { chars, glyphs } = get();
          if (chars.includes(char)) return set({ current: char });
          record();
          set({
            chars: [...chars, char],
            glyphs: { ...glyphs, [char]: freshGlyph() },
            current: char,
          });
        },
        removeChar: (char) => {
          if (DEFAULT_CHARS.includes(char)) return;
          const { chars, glyphs, current } = get();
          record();
          const rest = { ...glyphs };
          delete rest[char];
          set({
            chars: chars.filter((c) => c !== char),
            glyphs: rest,
            current: current === char ? "A" : current,
          });
        },

        spin: () => {
          record();
          set((s) => ({ glyphs: { ...s.glyphs, [s.current]: freshGlyph() } }));
        },
        spinAll: () => {
          record();
          set((s) => ({ glyphs: mapGlyphs(s.glyphs, () => freshGlyph()) }));
        },
        clearGlyph: () => {
          if (!get().glyphs[get().current].filled.length) return;
          record();
          set((s) => ({
            glyphs: { ...s.glyphs, [s.current]: { ...s.glyphs[s.current], filled: [] } },
          }));
        },

        beginStroke: () => record(),
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

        reset: () => {
          record();
          set({ chars: DEFAULT_CHARS, glyphs: initialGlyphs(), current: "A" });
        },

        // Restoring `current` jumps back to the letter that was edited, so the change is visible.
        undo: () => {
          const s = get();
          const prev = s.past.at(-1);
          if (!prev) return;
          lastKey = "";
          set({ ...prev, past: s.past.slice(0, -1), future: [...s.future, snapshot(s)] });
        },
        redo: () => {
          const s = get();
          const next = s.future.at(-1);
          if (!next) return;
          lastKey = "";
          set({ ...next, future: s.future.slice(0, -1), past: [...s.past, snapshot(s)] });
        },
      };
    },
    {
      name: "kaleidoscope-font-v1",
      version: 2,
      migrate: (state) => {
        const s = state as { fontName?: string; fill?: string };
        // v0 shipped with "Kaleidoscope" as the untouched default name
        if (s?.fontName === "Kaleidoscope") s.fontName = "My Font #1";
        // v1 had a star "glitter" fill, since replaced by rings
        if (s?.fill === "stars") s.fill = "rings";
        return s as never;
      },
      // history lives for the session only
      partialize: (s) => ({ ...snapshot(s), fontName: s.fontName }),
    },
  ),
);

/** The current style as one stable object (re-created only when a style field changes). */
export function useGlyphStyle(): GlyphStyle {
  const roundness = useFontStore((s) => s.roundness);
  const fill = useFontStore((s) => s.fill);
  const grain = useFontStore((s) => s.grain);
  return useMemo(() => ({ roundness, fill, grain }), [roundness, fill, grain]);
}

function snapshot(s: Snapshot): Snapshot {
  const { chars, glyphs, current, symmetry, density, roundness, fill, grain } = s;
  return { chars, glyphs, current, symmetry, density, roundness, fill, grain };
}

function mapGlyphs(
  glyphs: Record<string, GlyphState>,
  fn: (g: GlyphState) => GlyphState,
): Record<string, GlyphState> {
  return Object.fromEntries(Object.entries(glyphs).map(([k, g]) => [k, fn(g)]));
}
