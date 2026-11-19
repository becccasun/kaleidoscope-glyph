import { generateKaleidoscope } from "../lib/geometry";
import { buildFont } from "../lib/font";
import { writeFileSync } from "node:fs";

const k = generateKaleidoscope(123456, 8, 7);
console.log("cells:", k.cells.length, "find(0.3,0.1):", k.find(0.3, 0.1), "find(2,2):", k.find(2, 2));
// symmetry sanity: cell count divisible by symmetry (up to seam cells)
const filled = k.cells.map((_, i) => i).filter((i) => i % 3 === 0);
const bytes = await buildFont([{ char: "A", cells: k.cells, filled }, { char: "7", cells: k.cells, filled: [1,2] }], { familyName: "Test" });
console.log("otf bytes:", bytes.byteLength);
writeFileSync("scripts/test.otf", Buffer.from(bytes));
const ot = await import("opentype.js");
const f = (ot.parse ?? ot.default.parse)(bytes);
console.log("parsed:", f.names.fontFamily, "glyphs:", f.numGlyphs, "A bbox:", JSON.stringify(f.charToGlyph("A").getBoundingBox()));

// styles: union + rounding + pattern fills all compile and parse back
const { styleGlyph } = await import("../lib/style");
const blob = k.cells.map((_, i) => i).filter((i) => k.cells[i].every(([x, y]) => x * x + y * y < 0.5));
const solidSharp = styleGlyph(k.cells, blob, 8, { roundness: 0, fill: "solid", grain: 12 });
console.log("union of", blob.length, "cells →", solidSharp.length, "contour(s)");
if (solidSharp.length !== 1) throw new Error("expected a central blob to merge into one contour");
for (const style of [
  { roundness: 0.6, fill: "solid", grain: 12 },
  { roundness: 0.3, fill: "dots", grain: 14 },
  { roundness: 1, fill: "stars", grain: 10 },
] as const) {
  const c = styleGlyph(k.cells, blob, 8, style);
  const b = await buildFont([{ char: "A", cells: k.cells, filled: blob }], { familyName: "T", symmetry: 8, style });
  const g = (ot.parse ?? ot.default.parse)(b).charToGlyph("A");
  console.log(`${style.fill} r=${style.roundness}:`, c.length, "contours,", g.path.commands.length, "cmds, bbox", JSON.stringify(g.getBoundingBox()));
  if (!c.length || !g.path.commands.length) throw new Error(`empty glyph for ${style.fill}`);
}

// regression: vertices on a mirror axis print as -0 in one cell and 0 in its neighbour.
// Their shared edges must still cancel, or pattern fills leak into cells nobody filled.
{
  const k12 = generateKaleidoscope(804049166, 12, 11);
  const pick = [16,17,20,22,29,38,39,40,103,111,134,136,137,141,164,165,166,167,188,189,190,191,207,208,209,212,214,215,230,231,239,254,256,257,262,263,284,285,286,287,144];
  const inCell = (poly: number[][], x: number, y: number) => {
    let w = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const [xi, yi] = poly[i], [xj, yj] = poly[j];
      if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) w = !w;
    }
    return w;
  };
  const stars = styleGlyph(k12.cells, pick, 12, { roundness: 0, fill: "stars", grain: 24 });
  let leaked = 0;
  for (const c of stars) {
    const pts = [c.start, ...c.segs.map((s) => s.to)];
    const x = pts.reduce((a, p) => a + p[0], 0) / pts.length;
    const y = pts.reduce((a, p) => a + p[1], 0) / pts.length;
    // a star whose every point is outside the filled cells has leaked
    if (!pick.some((f) => pts.some((p) => inCell(k12.cells[f], p[0], p[1])) || inCell(k12.cells[f], x, y))) leaked++;
  }
  console.log("axis-edge regression:", stars.length, "stars,", leaked, "leaked");
  if (leaked) throw new Error(`${leaked} stars landed outside the filled cells`);
}
