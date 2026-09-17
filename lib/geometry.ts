import { Delaunay } from "d3-delaunay";

export type Point = [number, number];
/** A closed polygon in normalized space: center (0,0), radius 1. */
export type Cell = Point[];

export interface Kaleidoscope {
  seed: number;
  symmetry: number;
  density: number;
  /** Interactive cells (inside the circle). Index is stable for a given seed/symmetry/density. */
  cells: Cell[];
  /** Nearest-cell lookup in normalized space. */
  find: (x: number, y: number) => number;
}

/** Deterministic 32-bit PRNG (mulberry32) so every glyph can be rebuilt from its seed. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function randomSeed(): number {
  return Math.floor(Math.random() * 0xffffffff);
}

const OUTER_RING = 1.12;
const OUTER_COUNT = 96;

/**
 * Builds a radially symmetric Voronoi partition of the unit disc.
 *
 * 1. Scatter `density` sites inside one half-wedge (angle 0..π/symmetry).
 * 2. Mirror them across the wedge bisector → a full wedge with reflective symmetry.
 * 3. Rotate the wedge `symmetry` times → dihedral (kaleidoscope) symmetry.
 * 4. Add a ring of hidden boundary sites just outside the disc so edge cells
 *    are closed, roughly circular polygons instead of running to infinity.
 */
export function generateKaleidoscope(
  seed: number,
  symmetry: number,
  density: number,
): Kaleidoscope {
  const rand = mulberry32(seed);
  const wedge = (Math.PI * 2) / symmetry;
  const half = wedge / 2;

  const base: Array<[number, number]> = []; // [r, theta] within the half-wedge
  for (let i = 0; i < density; i++) {
    // sqrt keeps the areal distribution uniform; bias slightly toward the rim for open centers
    const r = 0.08 + 0.9 * Math.sqrt(rand());
    const t = rand() * half;
    base.push([r, t]);
  }
  // one site on the bisector produces a clean seam
  base.push([0.35 + 0.5 * rand(), half]);

  const sites: Point[] = [];
  for (let k = 0; k < symmetry; k++) {
    const rot = k * wedge;
    for (const [r, t] of base) {
      sites.push([r * Math.cos(rot + t), r * Math.sin(rot + t)]);
      if (t < half - 1e-9) {
        const m = wedge - t; // mirror across bisector
        sites.push([r * Math.cos(rot + m), r * Math.sin(rot + m)]);
      }
    }
  }
  // a site at the origin gives the pattern a clean central polygon instead of N slivers
  sites.unshift([0, 0]);
  // dedupe near-coincident sites (mirrors on the seam etc.)
  const interior = dedupe(sites);
  const interiorCount = interior.length;

  const all: Point[] = [...interior];
  for (let i = 0; i < OUTER_COUNT; i++) {
    const a = (i / OUTER_COUNT) * Math.PI * 2;
    all.push([OUTER_RING * Math.cos(a), OUTER_RING * Math.sin(a)]);
  }

  const delaunay = Delaunay.from(all);
  const voronoi = delaunay.voronoi([-2, -2, 2, 2]);

  // cells[c] ↔ site indexMap⁻¹(c). Degenerate (unbounded/empty) cells are skipped.
  const cells: Cell[] = [];
  const indexMap = new Map<number, number>();
  for (let i = 0; i < interiorCount; i++) {
    const poly = voronoi.cellPolygon(i);
    if (!poly || poly.length < 4) continue;
    indexMap.set(i, cells.length);
    cells.push(poly.slice(0, -1).map(([x, y]) => [x, y] as Point));
  }

  const find = (x: number, y: number) => {
    if (x * x + y * y > 1.02) return -1;
    const site = delaunay.find(x, y);
    if (site >= interiorCount) return -1;
    return indexMap.get(site) ?? -1;
  };

  return { seed, symmetry, density, cells, find };
}

function dedupe(points: Point[]): Point[] {
  const out: Point[] = [];
  const key = new Set<string>();
  for (const p of points) {
    const k = `${p[0].toFixed(4)},${p[1].toFixed(4)}`;
    if (key.has(k)) continue;
    key.add(k);
    out.push(p);
  }
  return out;
}

/** SVG path data for a set of cells, mapped by an affine transform. */
export function cellsToSvgPath(
  cells: Cell[],
  indices: Iterable<number>,
  transform: (p: Point) => Point,
  precision = 2,
): string {
  let d = "";
  for (const i of indices) {
    const cell = cells[i];
    if (!cell) continue;
    cell.forEach((p, j) => {
      const [x, y] = transform(p);
      d += `${j === 0 ? "M" : "L"}${x.toFixed(precision)} ${y.toFixed(precision)}`;
    });
    d += "Z";
  }
  return d;
}
