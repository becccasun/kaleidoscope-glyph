import type { Cell, Point } from "./geometry";

export interface GlyphSource {
  char: string;
  cells: Cell[];
  filled: number[];
}

export interface FontOptions {
  familyName: string;
  styleName?: string;
}

/**
 * Font metrics. The kaleidoscope disc maps to a 700-unit square that sits on the
 * baseline; everything else is standard 1000 upm proportions.
 */
export const UPM = 1000;
export const ASCENDER = 800;
export const DESCENDER = -200;
export const GLYPH_SIZE = 700;
export const SIDE_BEARING = 40;
export const ADVANCE = GLYPH_SIZE + SIDE_BEARING * 2;

/** normalized disc space (center 0,0 / r=1, y down) → font units (y up, on baseline) */
export function toFontUnits([x, y]: Point): Point {
  const half = GLYPH_SIZE / 2;
  return [SIDE_BEARING + half + x * half, half - y * half];
}

/** Builds an OpenType font from glyph sources and returns the .otf bytes. */
export async function buildFont(
  glyphs: GlyphSource[],
  opts: FontOptions,
): Promise<ArrayBuffer> {
  const opentype = await loadOpentype();

  const notdef = new opentype.Glyph({
    name: ".notdef",
    unicode: 0,
    advanceWidth: ADVANCE,
    path: new opentype.Path(),
  });

  const space = new opentype.Glyph({
    name: "space",
    unicode: 32,
    advanceWidth: Math.round(ADVANCE * 0.5),
    path: new opentype.Path(),
  });

  const built = glyphs
    .filter((g) => g.filled.length > 0)
    .map((g) => {
      const path = new opentype.Path();
      for (const i of g.filled) {
        const cell = g.cells[i];
        if (!cell) continue;
        // Cells share edges but never overlap, and all carry the same winding,
        // so nonzero fill unions them into one solid shape.
        cell.forEach((p, j) => {
          const [x, y] = toFontUnits(p);
          if (j === 0) path.moveTo(r(x), r(y));
          else path.lineTo(r(x), r(y));
        });
        path.close();
      }
      const code = g.char.codePointAt(0)!;
      return new opentype.Glyph({
        name: glyphName(g.char, code),
        unicode: code,
        advanceWidth: ADVANCE,
        path,
      });
    });

  const font = new opentype.Font({
    familyName: opts.familyName || "Kaleidoscope",
    styleName: opts.styleName || "Regular",
    unitsPerEm: UPM,
    ascender: ASCENDER,
    descender: DESCENDER,
    glyphs: [notdef, space, ...built],
  });

  return font.toArrayBuffer();
}

type Opentype = typeof import("opentype.js");

/** ESM build exposes named exports; the CJS build (Node/tests) nests them under `default`. */
async function loadOpentype(): Promise<Opentype> {
  const mod = (await import("opentype.js")) as Opentype & { default?: Opentype };
  return "Font" in mod && mod.Font ? mod : mod.default!;
}

function glyphName(char: string, code: number): string {
  if (/^[A-Za-z]$/.test(char)) return char;
  if (/^[0-9]$/.test(char)) {
    return ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine"][+char];
  }
  return `uni${code.toString(16).toUpperCase().padStart(4, "0")}`;
}

const r = (n: number) => Math.round(n);

export function downloadBlob(bytes: ArrayBuffer, filename: string, type: string) {
  const blob = new Blob([bytes], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
