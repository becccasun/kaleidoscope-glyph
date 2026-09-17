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
