"use client";

import { useMemo } from "react";
import { contoursToSvgPath, styleGlyph, type GlyphStyle } from "@/lib/style";
import { useKaleidoscope } from "@/lib/useKaleidoscope";

interface Props {
  seed: number;
  symmetry: number;
  density: number;
  filled: number[];
  style: GlyphStyle;
  size?: number;
  className?: string;
}

/** Vector thumbnail of a glyph — the same path data that ends up in the font. */
export function GlyphThumb({ seed, symmetry, density, filled, style, size = 40, className }: Props) {
  const k = useKaleidoscope(seed, symmetry, density);
  const d = useMemo(
    () =>
      contoursToSvgPath(styleGlyph(k.cells, filled, symmetry, style), ([x, y]) => [50 + x * 48, 50 + y * 48]),
    [k, filled, symmetry, style],
  );
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} className={className} aria-hidden>
      <path d={d} fill="currentColor" />
    </svg>
  );
}
