import { mulberry32, type Kaleidoscope } from "./geometry";

/** The glass in the chamber: seven tones of white, so neighbouring beads still read apart. */
export const TONES = ["#FFFFFF", "#E9E9E6", "#F6F6F3", "#D9D9D5", "#FBFBF9", "#E1E1DD", "#EFEFEC"];

export const tone = (i: number) => TONES[((i % TONES.length) + TONES.length) % TONES.length];

/**
 * One tone index per cell. Cells that are mirror images of each other (same distance
 * from the center, same angle once folded into the half-wedge) share a tone, so the
 * shading keeps the kaleidoscope's symmetry. The seed picks which tone each orbit gets.
 */
export function cellColors(k: Kaleidoscope): number[] {
  const rand = mulberry32((k.seed ^ 0x9e3779b9) >>> 0);
  const wedge = (Math.PI * 2) / k.symmetry;
  const orbit = new Map<string, number>();
  let prev = -1;
  return k.cells.map((cell) => {
    let x = 0;
    let y = 0;
    for (const p of cell) {
      x += p[0];
      y += p[1];
    }
    x /= cell.length;
    y /= cell.length;
    const r = Math.hypot(x, y);
    const a = ((Math.atan2(y, x) % wedge) + wedge) % wedge;
    const folded = Math.min(a, wedge - a);
    const key = `${r.toFixed(2)}:${(folded * r).toFixed(2)}`;
    let c = orbit.get(key);
    if (c === undefined) {
      // avoid handing two orbits in a row the same glass
      do c = Math.floor(rand() * TONES.length);
      while (c === prev);
      prev = c;
      orbit.set(key, c);
    }
    return c;
  });
}

/** Center of a cell in normalized disc space. */
export function centroid(cell: ReadonlyArray<readonly [number, number]>): [number, number] {
  let x = 0;
  let y = 0;
  for (const p of cell) {
    x += p[0];
    y += p[1];
  }
  return [x / cell.length, y / cell.length];
}
