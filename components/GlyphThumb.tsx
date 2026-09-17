"use client";

import { useMemo } from "react";
import { cellsToSvgPath } from "@/lib/geometry";
import { useKaleidoscope } from "@/lib/useKaleidoscope";

interface Props {
  seed: number;
  symmetry: number;
  density: number;
  filled: number[];
  size?: number;
  className?: string;
}

/** Vector thumbnail of a glyph — the same path data that ends up in the font. */
export function GlyphThumb({ seed, symmetry, density, filled, size = 40, className }: Props) {
  const k = useKaleidoscope(seed, symmetry, density);
  const d = useMemo(
    () => cellsToSvgPath(k.cells, filled, ([x, y]) => [50 + x * 48, 50 + y * 48]),
    [k, filled],
  );
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} className={className} aria-hidden>
      <path d={d} fill="currentColor" />
    </svg>
  );
}
