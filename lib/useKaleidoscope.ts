import { useMemo } from "react";
import { generateKaleidoscope, type Kaleidoscope } from "./geometry";

/** Memoized partition for one glyph — rebuilt only when its seed or the global shape changes. */
export function useKaleidoscope(seed: number, symmetry: number, density: number): Kaleidoscope {
  return useMemo(() => generateKaleidoscope(seed, symmetry, density), [seed, symmetry, density]);
}
